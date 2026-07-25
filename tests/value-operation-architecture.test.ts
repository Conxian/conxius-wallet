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

type Edge = { from: string; to: string; kind: 'import' | 're-export' };

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
  source.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({ text: node.moduleSpecifier.text, kind: 'import' });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({ text: node.moduleSpecifier.text, kind: 're-export' });
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)) {
      specifiers.push({ text: node.moduleReference.expression.text, kind: 'import' });
    }
  });
  return specifiers;
}

function buildEdges(base: string, files: string[], compilerOptions: ts.CompilerOptions): Edge[] {
  const sourceSet = new Set(files);
  const edges: Edge[] = [];
  for (const from of files) {
    const absolute = join(base, from);
    const source = ts.createSourceFile(from, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const specifier of moduleSpecifiers(source)) {
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
    .filter((edge) => edge.kind === 'import' && exposed.has(edge.to) && !allowedImporters.includes(edge.from))
    .map((edge) => edge.from)
    .sort();
  return { importers: [...new Set(importers)], publicReExports };
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

    expect(boundaryViolations(
      'services/app-private/value-operation-authority.ts',
      ['App.tsx'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
    expect(boundaryViolations(
      'services/app-private/value-operation-capability-registry.ts',
      ['services/app-private/value-operation-authority.ts', 'services/value-operation.ts'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
    expect(boundaryViolations(
      'services/app-private/native-psbt.ts',
      ['services/signer.ts'],
      edges,
    )).toEqual({ importers: [], publicReExports: [] });
  });

  it('detects alias, normalized parent-path, root-source, and re-export bypasses', () => {
    const base = mkdtempSync(join(tmpdir(), 'conxius-boundary-'));
    temporaryDirectories.push(base);
    const fixtures: Record<string, string> = {
      'services/app-private/value-operation-authority.ts': 'export const createAuthority = () => null;',
      'services/app-private/value-operation-capability-registry.ts': 'export const issue = () => null;',
      'services/barrel.ts': "export * from '@/services/app-private/value-operation-authority';",
      'components/alias-bypass.ts': "import { createAuthority } from '@/services/app-private/value-operation-authority'; void createAuthority;",
      'components/normalized-bypass.ts': "import { issue } from '../services/other/../app-private/value-operation-capability-registry'; void issue;",
      'root-bypass.ts': "import { createAuthority } from './services/barrel'; void createAuthority;",
    };
    for (const [path, contents] of Object.entries(fixtures)) {
      mkdirSync(dirname(join(base, path)), { recursive: true });
      writeFileSync(join(base, path), contents);
    }
    const files = Object.keys(fixtures).sort();
    const edges = buildEdges(base, files, { ...compilerOptions, baseUrl: base, paths: { '@/*': ['./*'] } });

    expect(boundaryViolations('services/app-private/value-operation-authority.ts', [], edges)).toEqual({
      importers: ['components/alias-bypass.ts', 'root-bypass.ts'],
      publicReExports: ['services/barrel.ts'],
    });
    expect(boundaryViolations('services/app-private/value-operation-capability-registry.ts', [], edges)).toEqual({
      importers: ['components/normalized-bypass.ts'],
      publicReExports: [],
    });
  });

  it('does not expose a constructible confirmer from the shared feature API', () => {
    const shared = readFileSync(join(root, 'services/value-operation.ts'), 'utf8');
    expect(shared).not.toMatch(/createWalletValueOperationGate|createAppPrivateValueOperationAuthority/);
    expect(shared).not.toMatch(/export\s+(?:async\s+)?function\s+\w*(?:confirm|issue)\w*/i);
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
    expect(portal).toContain('requireValueOperationSettlementAuthorization(lightningOutcome, lightningRequest)');
    expect(portal).toContain('payLightningInvoice(recipient, amountSats, settlementAuthorization, network)');
    expect(portal).toContain('payLnurl(lnDetail.params, amountSats, settlementAuthorization, network)');
  });
});
