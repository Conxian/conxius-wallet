import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const excludedDirectories = new Set([
  '.git', '.github', '.husky', '.vscode', 'android', 'archives', 'benchmarks', 'dist', 'docs',
  'e2e', 'native', 'node_modules', 'openspec', 'public', 'scripts', 'tests',
]);
const excludedRootFiles = /(?:^|\/)(?:playwright|vite|eslint|postcss|tailwind)\.config\.[cm]?[jt]s$/;

type Edge = { from: string; to: string; kind: 'import' | 'dynamic-import' | 'require' | 're-export' | 'unsafe-loader' };
type RawPluginViolation = { path: string; kind: 'secure-enclave-access' | 'raw-signing-method' };

const rawSecureEnclaveAllowlist = new Set([
  'services/app-private/native-value-signing.ts',
  'services/app-private/secure-enclave-non-signing.ts',
]);

function normalized(path: string, base = root): string {
  return relative(base, path).replaceAll('\\', '/');
}

function productionFiles(base = root, directory = base): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (directory === base && excludedDirectories.has(entry)) continue;
    const absolute = join(directory, entry);
    const relativePath = normalized(absolute, base);
    if (statSync(absolute).isDirectory()) {
      files.push(...productionFiles(base, absolute));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts') && !excludedRootFiles.test(relativePath)) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function moduleSpecifiers(source: ts.SourceFile): Array<{ text: string; kind: Edge['kind'] }> {
  const specifiers: Array<{ text: string; kind: Edge['kind'] }> = [];
  const importedBindings = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleText = node.moduleSpecifier.text;
      specifiers.push({ text: moduleText, kind: 'import' });
      const clause = node.importClause;
      if (clause?.name) importedBindings.set(clause.name.text, moduleText);
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        importedBindings.set(clause.namedBindings.name.text, moduleText);
      } else if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        clause.namedBindings.elements.forEach((element) => importedBindings.set(element.name.text, moduleText));
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({ text: node.moduleSpecifier.text, kind: 're-export' });
    } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((element) => {
        const origin = importedBindings.get((element.propertyName ?? element.name).text);
        if (origin) specifiers.push({ text: origin, kind: 're-export' });
      });
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)) {
      specifiers.push({ text: node.moduleReference.expression.text, kind: 'import' });
    } else if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const kind = node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic-import' : 'require';
      const argument = node.arguments[0];
      if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
        specifiers.push({ text: argument.text, kind });
      } else {
        specifiers.push({ text: '<non-literal>', kind: 'unsafe-loader' });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function buildEdges(base: string, files: string[], compilerOptions: ts.CompilerOptions): Edge[] {
  const sourceSet = new Set(files);
  const edges: Edge[] = [];
  for (const from of files) {
    const absolute = join(base, from);
    const source = ts.createSourceFile(from, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const specifier of moduleSpecifiers(source)) {
      if (specifier.kind === 'unsafe-loader') {
        edges.push({ from, to: specifier.text, kind: specifier.kind });
        continue;
      }
      const resolution = ts.resolveModuleName(specifier.text, absolute, compilerOptions, ts.sys).resolvedModule;
      if (!resolution) continue;
      const to = normalized(resolve(resolution.resolvedFileName), base).replace(/\.d\.ts$/, '.ts');
      if (sourceSet.has(to)) edges.push({ from, to, kind: specifier.kind });
    }
  }
  return edges;
}

function exposedModules(target: string, edges: Edge[]): Set<string> {
  const exposed = new Set([target]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (edge.kind === 're-export' && exposed.has(edge.to) && !exposed.has(edge.from)) {
        exposed.add(edge.from);
        changed = true;
      }
    }
  }
  return exposed;
}

function boundaryViolations(target: string, allowedImporters: string[], edges: Edge[]) {
  const exposed = exposedModules(target, edges);
  const publicReExports = [...exposed].filter((path) => path !== target).sort();
  const importers = edges
    .filter((edge) => ['import', 'dynamic-import', 'require'].includes(edge.kind)
      && exposed.has(edge.to) && !allowedImporters.includes(edge.from))
    .map((edge) => edge.from)
    .sort();
  return { importers: [...new Set(importers)], publicReExports };
}

function rawSecureEnclaveViolations(base: string, files: string[]): RawPluginViolation[] {
  const violations: RawPluginViolation[] = [];
  for (const path of files) {
    if (rawSecureEnclaveAllowlist.has(path)) continue;
    const source = ts.createSourceFile(path, readFileSync(join(base, path), 'utf8'), ts.ScriptTarget.Latest, true);
    const kinds = new Set<RawPluginViolation['kind']>();
    const constStrings = new Map<string, string>();
    const registerPluginAliases = new Set<string>();
    const capacitorAliases = new Set<string>();
    const capacitorNamespaceAliases = new Set<string>();

    const stringValue = (node: ts.Expression | undefined): string | undefined => {
      if (!node) return undefined;
      if (ts.isParenthesizedExpression(node)) return stringValue(node.expression);
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
      if (ts.isIdentifier(node)) return constStrings.get(node.text);
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = stringValue(node.left);
        const right = stringValue(node.right);
        return left === undefined || right === undefined ? undefined : left + right;
      }
      if (ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'join'
        && ts.isArrayLiteralExpression(node.expression.expression)) {
        const separator = node.arguments.length === 0 ? ',' : stringValue(node.arguments[0]);
        const values = node.expression.expression.elements.map((element) => stringValue(element as ts.Expression));
        return separator === undefined || values.some((value) => value === undefined)
          ? undefined
          : (values as string[]).join(separator);
      }
      return undefined;
    };

    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)
        && ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === '@capacitor/core') {
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) capacitorNamespaceAliases.add(bindings.name.text);
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const imported = (element.propertyName ?? element.name).text;
            if (imported === 'registerPlugin') registerPluginAliases.add(element.name.text);
            if (imported === 'Capacitor') capacitorAliases.add(element.name.text);
          }
        }
      }
      if (ts.isVariableStatement(statement)
        && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            const value = stringValue(declaration.initializer);
            if (value !== undefined) constStrings.set(declaration.name.text, value);
          }
        }
      }
    }

    const isCapacitor = (node: ts.Expression): boolean => {
      if (ts.isIdentifier(node)) return capacitorAliases.has(node.text);
      return (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
        && node.name.text === 'Capacitor'
        && ts.isIdentifier(node.expression)
        && capacitorNamespaceAliases.has(node.expression.text);
    };
    const isCapacitorPlugins = (node: ts.Expression): boolean => {
      if ((ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
        && node.name.text === 'Plugins') return isCapacitor(node.expression);
      if ((ts.isElementAccessExpression(node) || ts.isElementAccessChain(node))
        && stringValue(node.argumentExpression) === 'Plugins') return isCapacitor(node.expression);
      return false;
    };
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)
        && ts.isObjectBindingPattern(node.name)
        && node.initializer
        && ts.isAwaitExpression(node.initializer)
        && ts.isCallExpression(node.initializer.expression)
        && node.initializer.expression.expression.kind === ts.SyntaxKind.ImportKeyword
        && stringValue(node.initializer.expression.arguments[0]) === '@capacitor/core') {
        for (const element of node.name.elements) {
          const imported = element.propertyName ?? element.name;
          if (ts.isIdentifier(imported) && imported.text === 'registerPlugin' && ts.isIdentifier(element.name)) {
            registerPluginAliases.add(element.name.text);
          }
        }
      }
      if (ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && registerPluginAliases.has(node.expression.text)) {
        const pluginName = stringValue(node.arguments[0]);
        if (pluginName === undefined || pluginName === 'SecureEnclave') kinds.add('secure-enclave-access');
      }
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === 'SecureEnclave') {
        kinds.add('secure-enclave-access');
      }
      if ((ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
        && isCapacitorPlugins(node.expression)) {
        kinds.add('secure-enclave-access');
      }
      if ((ts.isElementAccessExpression(node) || ts.isElementAccessChain(node))
        && isCapacitorPlugins(node.expression)) {
        kinds.add('secure-enclave-access');
      }
      if ((ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
        && node.name.text === 'SecureEnclave') {
        kinds.add('secure-enclave-access');
      }
      if ((ts.isElementAccessExpression(node) || ts.isElementAccessChain(node))
        && node.argumentExpression
        && (ts.isStringLiteral(node.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))
        && node.argumentExpression.text === 'SecureEnclave') {
        kinds.add('secure-enclave-access');
      }
      if ((ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
        && ['signTransaction', 'signBatch'].includes(node.name.text)) {
        kinds.add('raw-signing-method');
      }
      if ((ts.isElementAccessExpression(node) || ts.isElementAccessChain(node))
        && node.argumentExpression
        && ['signTransaction', 'signBatch'].includes(stringValue(node.argumentExpression) ?? '')) {
        kinds.add('raw-signing-method');
      }
      if (ts.isBindingElement(node)) {
        const name = (node.propertyName ?? node.name);
        if (ts.isIdentifier(name) && ['signTransaction', 'signBatch'].includes(name.text)) {
          kinds.add('raw-signing-method');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    kinds.forEach((kind) => violations.push({ path, kind }));
  }
  return violations.sort((a, b) => `${a.path}:${a.kind}`.localeCompare(`${b.path}:${b.kind}`));
}

const compilerOptions: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  baseUrl: root,
  paths: { '@/*': ['./*'] },
  allowImportingTsExtensions: true,
};

const temporaryDirectories: string[] = [];
afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('App-private value-operation authority architecture', () => {
  it('enforces resolver-aware production boundaries across the repository', () => {
    const files = productionFiles();
    expect(files).toEqual(expect.arrayContaining(['App.tsx', 'index.tsx', 'context.tsx', 'constants.tsx']));
    const edges = buildEdges(root, files, compilerOptions);
    expect(edges.filter((edge) => edge.kind === 'unsafe-loader').map((edge) => edge.from)).toEqual([]);

    expect(boundaryViolations(
      'services/app-private/value-operation-authority.ts',
      [
        'App.tsx',
        'services/breez.ts',
        'services/lightning-backend.ts',
        'services/lightning.ts',
        'services/protocol.ts',
        'services/value-operation.ts',
        'services/wormhole-signer.ts',
      ],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
    expect(boundaryViolations(
      'services/app-private/value-operation-signer.ts',
      ['services/app-private/value-operation-authority.ts'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
    expect(boundaryViolations(
      'services/app-private/native-value-signing.ts',
      ['services/app-private/value-operation-signer.ts'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
    expect(boundaryViolations(
      'services/app-private/secure-enclave-non-signing.ts',
      ['services/enclave-storage.ts'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
    expect(boundaryViolations(
      'services/app-private/native-psbt.ts',
      ['services/app-private/value-operation-signer.ts'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
  });

  it('detects alias, normalized parent-path, root-source, and re-export bypasses', () => {
    const base = mkdtempSync(join(tmpdir(), 'conxius-boundary-'));
    temporaryDirectories.push(base);
    const fixtures: Record<string, string> = {
      'services/app-private/value-operation-authority.ts': 'export const createAuthority = () => null;',
      'services/value-operation-capability-consumer.ts': 'export interface Consumer { consume(): void }',
      'services/barrel.ts': "export * from '@/services/app-private/value-operation-authority';",
      'components/alias-bypass.ts': "import { createAuthority } from '@/services/app-private/value-operation-authority'; void createAuthority;",
      'root-bypass.ts': "import { createAuthority } from './services/barrel'; void createAuthority;",
      'components/dynamic-bypass.ts': "export async function bypass() { return import('@/services/app-private/value-operation-authority'); }",
      'components/require-bypass.ts': "const authority = require('../services/app-private/value-operation-authority'); void authority;",
      'components/runtime-wrapper.ts': "import { createAuthority } from '@/services/app-private/value-operation-authority'; export { createAuthority };",
    };
    for (const [path, contents] of Object.entries(fixtures)) {
      mkdirSync(dirname(join(base, path)), { recursive: true });
      writeFileSync(join(base, path), contents);
    }
    const files = Object.keys(fixtures).sort();
    const edges = buildEdges(base, files, { ...compilerOptions, baseUrl: base, paths: { '@/*': ['./*'] } });

    expect(boundaryViolations('services/app-private/value-operation-authority.ts', [], edges)).toEqual({
      importers: ['components/alias-bypass.ts', 'components/dynamic-bypass.ts', 'components/require-bypass.ts', 'components/runtime-wrapper.ts', 'root-bypass.ts'],
      publicReExports: ['components/runtime-wrapper.ts', 'services/barrel.ts'],
    });
  });

  it('rejects raw SecureEnclave registration, aliases, plugin access, signing methods, and re-exports', () => {
    const base = mkdtempSync(join(tmpdir(), 'conxius-raw-plugin-'));
    temporaryDirectories.push(base);
    const fixtures: Record<string, string> = {
      'services/app-private/native-value-signing.ts': "import { registerPlugin } from '@capacitor/core'; export const sign = registerPlugin('SecureEnclave');",
      'services/app-private/secure-enclave-non-signing.ts': "import { registerPlugin } from '@capacitor/core'; export const storage = registerPlugin('SecureEnclave');",
      'components/direct.ts': "import { registerPlugin } from '@capacitor/core'; registerPlugin('SecureEnclave');",
      'components/imported-alias.ts': "import { registerPlugin as raw } from '@capacitor/core'; raw('SecureEnclave');",
      'components/dynamic-destructured.ts': "export async function load() { const { registerPlugin: raw } = await import('@capacitor/core'); return raw('SecureEnclave'); }",
      'components/capacitor-property.ts': "import { Capacitor as C } from '@capacitor/core'; void C.Plugins.SecureEnclave;",
      'components/capacitor-element.ts': "import * as core from '@capacitor/core'; void core.Capacitor['Plugins']['SecureEnclave'];",
      'components/computed-register.ts': "import { registerPlugin } from '@capacitor/core'; const n = ['Secure', 'Enclave'].join(''); registerPlugin(n);",
      'components/unknown-register.ts': "import { registerPlugin } from '@capacitor/core'; export const load = (n: string) => registerPlugin(n);",
      'components/computed-capacitor.ts': "import { Capacitor } from '@capacitor/core'; const n = ['Secure', 'Enclave'].join(''); void Capacitor.Plugins[n];",
      'components/computed-method.ts': "const method = 'sign' + 'Transaction'; export const call = (plugin: any) => plugin[method]({});",
      'components/computed-method-extraction.ts': "const method = `signBatch`; export const take = (plugin: any) => { const fn = plugin[method]; return fn; };",
      'components/method-call.ts': 'export const call = (plugin: any) => plugin.signTransaction({});',
      'components/method-extraction.ts': 'export const take = (plugin: any) => { const { signBatch: batch } = plugin; return batch; };',
      'services/raw-barrel.ts': "export * from './app-private/native-value-signing';",
    };
    for (const [path, contents] of Object.entries(fixtures)) {
      mkdirSync(dirname(join(base, path)), { recursive: true });
      writeFileSync(join(base, path), contents);
    }
    const files = Object.keys(fixtures).sort();
    expect(rawSecureEnclaveViolations(base, files)).toEqual([
      { path: 'components/capacitor-element.ts', kind: 'secure-enclave-access' },
      { path: 'components/capacitor-property.ts', kind: 'secure-enclave-access' },
      { path: 'components/computed-capacitor.ts', kind: 'secure-enclave-access' },
      { path: 'components/computed-method-extraction.ts', kind: 'raw-signing-method' },
      { path: 'components/computed-method.ts', kind: 'raw-signing-method' },
      { path: 'components/computed-register.ts', kind: 'secure-enclave-access' },
      { path: 'components/direct.ts', kind: 'secure-enclave-access' },
      { path: 'components/dynamic-destructured.ts', kind: 'secure-enclave-access' },
      { path: 'components/imported-alias.ts', kind: 'secure-enclave-access' },
      { path: 'components/method-call.ts', kind: 'raw-signing-method' },
      { path: 'components/method-extraction.ts', kind: 'raw-signing-method' },
      { path: 'components/unknown-register.ts', kind: 'secure-enclave-access' },
    ]);
    const edges = buildEdges(base, files, { ...compilerOptions, baseUrl: base });
    expect(boundaryViolations('services/app-private/native-value-signing.ts', [], edges).publicReExports)
      .toEqual(['services/raw-barrel.ts']);
  });

  it('keeps all raw SecureEnclave production access inside the two private adapters', () => {
    expect(rawSecureEnclaveViolations(root, productionFiles())).toEqual([]);
  });

  it('exports no runtime registration, issuer, factory, or minting surface from the consume-side module', async () => {
    const consumerModule = await import('../services/value-operation-capability-consumer');
    expect(Object.keys(consumerModule)).toEqual([]);
  });

  it('exposes only assert access to authority consumers and no consumer-registration surface', () => {
    const authority = readFileSync(join(root, 'services/app-private/value-operation-authority.ts'), 'utf8');
    expect(authority).toContain('export function assertTrustedValueOperationCapabilityConsumer');
    expect(authority).not.toMatch(/export\s+(?:function|const)\s+\w*(?:register|mint|issue)\w*Consumer/i);

    for (const path of [
      'services/breez.ts',
      'services/lightning-backend.ts',
      'services/lightning.ts',
      'services/protocol.ts',
      'services/value-operation.ts',
      'services/wormhole-signer.ts',
    ]) {
      const source = readFileSync(join(root, path), 'utf8');
      expect(source, path).toMatch(/import\s*{\s*assertTrustedValueOperationCapabilityConsumer\s*}\s*from\s*['"].*app-private\/value-operation-authority['"]/);
      expect(source, path).not.toMatch(/import\s*{[^}]*createAppPrivateValueOperationAuthority[^}]*}\s*from\s*['"].*app-private\/value-operation-authority['"]/);
    }
  });

  it('does not expose a constructible confirmer from the shared feature API', () => {
    const shared = readFileSync(join(root, 'services/value-operation.ts'), 'utf8');
    expect(shared).not.toMatch(/createWalletValueOperationGate|createAppPrivateValueOperationAuthority/);
    expect(shared).not.toMatch(/export\s+(?:async\s+)?function\s+\w*(?:confirm|issue)\w*/i);
  });

  it('fails closed on non-literal dynamic import and require loaders', () => {
    const base = mkdtempSync(join(tmpdir(), 'conxius-loader-boundary-'));
    temporaryDirectories.push(base);
    const fixtures = {
      'components/dynamic.ts': 'export const load = (path: string) => import(path);',
      'components/require.ts': 'export const load = (path: string) => require(path);',
    };
    for (const [path, contents] of Object.entries(fixtures)) {
      mkdirSync(dirname(join(base, path)), { recursive: true });
      writeFileSync(join(base, path), contents);
    }
    const edges = buildEdges(base, Object.keys(fixtures), { ...compilerOptions, baseUrl: base });
    expect(edges.filter((edge) => edge.kind === 'unsafe-loader').map((edge) => edge.from).sort()).toEqual([
      'components/dynamic.ts',
      'components/require.ts',
    ]);
  });

  it('removes production mnemonic/seed PSBT signing APIs', () => {
    const psbt = readFileSync(join(root, 'services/psbt.ts'), 'utf8');
    expect(psbt).not.toMatch(/signPsbtBase64|mnemonicToSeed|\bfromSeed\b|fromPrivateKey/);
    for (const path of productionFiles()) {
      const source = readFileSync(join(root, path), 'utf8');
      expect(source, path).not.toMatch(/\bsignPsbtBase64(?:WithSeed(?:ReturnBase64)?)?\b/);
      expect(source, path).not.toMatch(/export\s+(?:const|function)\s+\w*(?:sign|settle)\w*[^=]*(?:mnemonic|seed)\b/i);
    }
  });

  it('carries the exact BOLT11 amount and queue-issued capability into PaymentPortal submission', () => {
    const portal = readFileSync(join(root, 'components/PaymentPortal.tsx'), 'utf8');
    expect(portal).toContain("{ kind: 'bolt11', invoice: recipient, amountSats }");
    expect(portal).toContain('requireValueOperationSettlementAuthorization(consumer, lightningOutcome, lightningRequest)');
    expect(portal).toContain('payLightningInvoice(recipient, amountSats, settlementAuthorization, network, consumer)');
    expect(portal).toContain('payLnurl(lnDetail.params, amountSats, settlementAuthorization, network, consumer)');
  });

  it('keeps signing and PSBT finalization off shared production APIs', () => {
    const signer = readFileSync(join(root, 'services/signer.ts'), 'utf8');
    const enclave = readFileSync(join(root, 'services/enclave-storage.ts'), 'utf8');
    expect(signer).not.toMatch(/requestEnclaveSignature|signNative|finalizeNativePsbt/);
    expect(enclave).not.toMatch(/registerPlugin|['"]SecureEnclave['"]|export\s+(?:async\s+)?function\s+sign/);
  });
});
