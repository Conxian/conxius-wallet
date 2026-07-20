#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = { output: 'release-payload/conxius-wallet.sbom.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output') {
      args.output = argv[++index];
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  return args;
}

function packageUrl(name, version) {
  const packagePath = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${packagePath}@${version}`;
}

function componentFor(name, dependency) {
  const purl = packageUrl(name, dependency.version);
  return {
    type: 'library',
    'bom-ref': purl,
    name,
    version: dependency.version,
    purl,
    ...(dependency.resolved
      ? {
          externalReferences: [
            {
              type: 'distribution',
              url: dependency.resolved,
            },
          ],
        }
      : {}),
  };
}

function isWithin(candidate, root) {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

export function safeOutputPath(rootDir, outputPath) {
  const requested = resolve(rootDir, outputPath);
  if (basename(requested) !== 'conxius-wallet.sbom.json' || basename(dirname(requested)) !== 'release-payload') {
    fail('SBOM output must be release-payload/conxius-wallet.sbom.json under an approved root.');
  }

  const approvedRoots = [rootDir, process.env.RUNNER_TEMP, process.env.TMPDIR, '/tmp']
    .filter(Boolean)
    .filter((root) => existsSync(root))
    .map((root) => realpathSync(root));
  let existingAncestor = dirname(requested);
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) fail(`Unable to resolve SBOM output parent: ${requested}`);
    existingAncestor = parent;
  }
  const canonicalAncestor = realpathSync(existingAncestor);
  const canonicalRequested = resolve(canonicalAncestor, relative(existingAncestor, requested));
  if (!approvedRoots.some((root) => isWithin(canonicalRequested, root))) {
    fail(`SBOM output is outside the approved repository/temporary roots: ${requested}`);
  }
  if (existsSync(requested)) {
    const stat = lstatSync(requested);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`SBOM output must be a regular non-symlink file: ${requested}`);
    fail(`Refusing to overwrite an existing SBOM: ${requested}`);
  }
  mkdirSync(dirname(requested), { recursive: true });
  const canonicalParent = realpathSync(dirname(requested));
  if (!approvedRoots.some((root) => isWithin(canonicalParent, root))) {
    fail(`SBOM output parent escaped the approved roots: ${requested}`);
  }
  return requested;
}

function collectDependencies(root) {
  const components = new Map();
  const dependencyEdges = new Map();
  const visitedRefs = new Set();

  function visit(parentRef, dependencies = {}) {
    const childRefs = [];
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (!dependency || typeof dependency.version !== 'string' || dependency.version.length === 0) {
        continue;
      }
      const component = componentFor(name, dependency);
      const ref = component['bom-ref'];
      components.set(ref, component);
      childRefs.push(ref);
      if (!visitedRefs.has(ref)) {
        visitedRefs.add(ref);
        visit(ref, dependency.dependencies);
      }
    }
    if (parentRef && childRefs.length > 0) {
      const existing = dependencyEdges.get(parentRef) ?? new Set();
      for (const ref of childRefs) existing.add(ref);
      dependencyEdges.set(parentRef, existing);
    }
  }

  const rootRef = packageUrl(root.name, root.version);
  visit(rootRef, root.dependencies);

  return {
    components: [...components.values()].sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref'])),
    dependencies: [
      { ref: rootRef, dependsOn: [...(dependencyEdges.get(rootRef) ?? [])].sort() },
      ...[...dependencyEdges.entries()]
        .filter(([ref]) => ref !== rootRef)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() })),
    ],
    rootRef,
  };
}

export function generateSbom({ rootDir = process.cwd(), outputPath = 'release-payload/conxius-wallet.sbom.json' } = {}) {
  const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
  const dependencyTree = spawnSync('pnpm', ['list', '--prod', '--json', '--depth', 'Infinity'], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (dependencyTree.error) {
    fail(`Unable to run pnpm list for SBOM generation: ${dependencyTree.error.message}`);
  }
  if (dependencyTree.status !== 0) {
    fail(`pnpm list failed while generating the SBOM: ${dependencyTree.stderr.trim()}`);
  }

  let roots;
  try {
    roots = JSON.parse(dependencyTree.stdout);
  } catch (error) {
    fail(`pnpm list returned invalid JSON while generating the SBOM: ${error.message}`);
  }
  if (!Array.isArray(roots) || roots.length !== 1) {
    fail('SBOM generation requires exactly one pnpm project root.');
  }

  const root = roots[0];
  const rootComponent = {
    type: 'application',
    'bom-ref': packageUrl(packageJson.name, packageJson.version),
    name: packageJson.name,
    version: packageJson.version,
    purl: packageUrl(packageJson.name, packageJson.version),
  };
  const { components, dependencies, rootRef } = collectDependencies({
    ...root,
    name: packageJson.name,
    version: packageJson.version,
  });
  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${createHash('sha256').update(`${packageJson.name}@${packageJson.version}`).digest('hex').slice(0, 32)}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'Conxian Labs',
          name: 'scripts/ci/generate_sbom.mjs',
          version: '1.0.0',
        },
      ],
      component: rootComponent,
    },
    components,
    dependencies: dependencies.map((dependency) =>
      dependency.ref === rootRef ? { ...dependency, ref: rootComponent['bom-ref'] } : dependency,
    ),
  };

  const output = safeOutputPath(rootDir, outputPath);
  writeFileSync(output, `${JSON.stringify(bom, null, 2)}\n`, { flag: 'wx' });
  console.log(`CycloneDX SBOM generated: ${output} (${components.length} production components)`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    generateSbom({ outputPath: args.output });
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
