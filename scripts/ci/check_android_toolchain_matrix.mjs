import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANDROID_TOOLCHAIN_PATHS = Object.freeze({
  catalog: 'android/gradle/libs.versions.toml',
  appBuild: 'android/app/build.gradle.kts',
  wrapper: 'android/gradle/wrapper/gradle-wrapper.properties',
  ciWorkflow: '.github/workflows/ci.yml',
  releaseWorkflow: '.github/workflows/android-release.yml',
});

const DEFAULT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REQUIRED_CATALOG_VERSIONS = ['agp', 'kotlin', 'ksp', 'compose-bom'];
const REQUIRED_PLUGIN_VERSION_REFS = Object.freeze({
  'android-application': 'agp',
  'android-library': 'agp',
  'compose-compiler': 'kotlin',
  ksp: 'ksp',
});

function describeSet(values) {
  return values.length > 0 ? values.join(', ') : 'missing';
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function parseTomlSections(catalog) {
  const sections = new Map();
  let section = null;

  for (const rawLine of catalog.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    const sectionMatch = line.match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (!sections.has(section)) {
        sections.set(section, []);
      }
      continue;
    }

    const entryMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (section && entryMatch) {
      sections.get(section).push({ key: entryMatch[1], value: entryMatch[2].trim() });
    }
  }

  return sections;
}

function quotedValue(value) {
  return value.match(/^"([^"]+)"$/)?.[1] ?? null;
}

function inlineTableReference(value, field) {
  const escapedField = field.replace('.', '\\.');
  return value.match(new RegExp(`(?:^|[,\\s{])${escapedField}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
}

function parseCatalog(catalog, errors) {
  if (typeof catalog !== 'string') {
    errors.push(`${ANDROID_TOOLCHAIN_PATHS.catalog} is missing.`);
    return { versions: {}, plugins: {}, libraries: {} };
  }

  const sections = parseTomlSections(catalog);
  const versionEntries = sections.get('versions') ?? [];
  const pluginEntries = sections.get('plugins') ?? [];
  const libraryEntries = sections.get('libraries') ?? [];
  const versions = {};
  const plugins = {};
  const libraries = {};

  for (const key of REQUIRED_CATALOG_VERSIONS) {
    const matches = versionEntries.filter((entry) => entry.key === key);
    if (matches.length !== 1) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} must declare [versions].${key} exactly once; found ${matches.length}.`,
      );
      continue;
    }
    const value = quotedValue(matches[0].value);
    if (!value) {
      errors.push(`${ANDROID_TOOLCHAIN_PATHS.catalog} [versions].${key} must be a quoted version string.`);
    } else {
      versions[key] = value;
    }
  }

  for (const alias of sortedUnique(pluginEntries.map((entry) => entry.key))) {
    const matches = pluginEntries.filter((entry) => entry.key === alias);
    if (matches.length !== 1) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} must declare [plugins].${alias} exactly once; found ${matches.length}.`,
      );
      continue;
    }

    const inlineVersion = inlineTableReference(matches[0].value, 'version');
    const versionRef = inlineTableReference(matches[0].value, 'version.ref');
    if (inlineVersion) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} [plugins].${alias} must resolve through version.ref, not inline version "${inlineVersion}".`,
      );
    } else if (!versionRef) {
      errors.push(`${ANDROID_TOOLCHAIN_PATHS.catalog} [plugins].${alias} is missing a version.ref declaration.`);
    } else if (versionEntries.filter((entry) => entry.key === versionRef).length !== 1) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} [plugins].${alias} references [versions].${versionRef}, which must exist exactly once.`,
      );
    }
  }

  for (const [alias, expectedRef] of Object.entries(REQUIRED_PLUGIN_VERSION_REFS)) {
    const matches = pluginEntries.filter((entry) => entry.key === alias);
    if (matches.length !== 1) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} must declare [plugins].${alias} exactly once; found ${matches.length}.`,
      );
      continue;
    }
    const versionRef = inlineTableReference(matches[0].value, 'version.ref');
    const inlineVersion = inlineTableReference(matches[0].value, 'version');
    if (inlineVersion) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} [plugins].${alias} must use version.ref = "${expectedRef}" instead of inline version "${inlineVersion}".`,
      );
    } else if (versionRef !== expectedRef) {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} [plugins].${alias} must use version.ref = "${expectedRef}"; found ${versionRef ? `"${versionRef}"` : 'no catalog version reference'}.`,
      );
    }
    plugins[alias] = versionRef;
  }

  const composeBom = libraryEntries.filter((entry) => entry.key === 'androidx-compose-bom');
  if (composeBom.length !== 1) {
    errors.push(
      `${ANDROID_TOOLCHAIN_PATHS.catalog} must declare [libraries].androidx-compose-bom exactly once; found ${composeBom.length}.`,
    );
  } else {
    const versionRef = inlineTableReference(composeBom[0].value, 'version.ref');
    if (versionRef !== 'compose-bom') {
      errors.push(
        `${ANDROID_TOOLCHAIN_PATHS.catalog} [libraries].androidx-compose-bom must use version.ref = "compose-bom"; found ${versionRef ? `"${versionRef}"` : 'no catalog version reference'}.`,
      );
    }
    libraries['androidx-compose-bom'] = versionRef;
  }

  return { versions, plugins, libraries };
}

function parseCompileSdk(appBuild, errors) {
  if (typeof appBuild !== 'string') {
    errors.push(`${ANDROID_TOOLCHAIN_PATHS.appBuild} is missing.`);
    return null;
  }

  const declarations = [...appBuild.matchAll(/^\s*compileSdk\s*=\s*(\d+)\s*$/gm)].map((match) =>
    Number(match[1]),
  );
  if (declarations.length !== 1) {
    errors.push(
      `${ANDROID_TOOLCHAIN_PATHS.appBuild} must declare a literal compileSdk exactly once; found ${declarations.length}.`,
    );
    return declarations[0] ?? null;
  }
  return declarations[0];
}

function parseGradleWrapper(wrapper, errors) {
  if (typeof wrapper !== 'string') {
    errors.push(`${ANDROID_TOOLCHAIN_PATHS.wrapper} is missing.`);
    return null;
  }

  const urls = [...wrapper.matchAll(/^distributionUrl\s*=\s*(\S+)\s*$/gm)].map((match) => match[1]);
  if (urls.length !== 1) {
    errors.push(
      `${ANDROID_TOOLCHAIN_PATHS.wrapper} must declare distributionUrl exactly once; found ${urls.length}.`,
    );
    return null;
  }

  const version = urls[0].match(/(?:^|\/)gradle-(\d+(?:\.\d+)+)-(?:bin|all)\.zip$/)?.[1] ?? null;
  if (!version) {
    errors.push(
      `${ANDROID_TOOLCHAIN_PATHS.wrapper} has a malformed or unsupported Gradle distributionUrl: ${urls[0]}.`,
    );
  }
  return version;
}

function workflowJobs(workflow, path, errors) {
  if (typeof workflow !== 'string') {
    errors.push(`${path} is missing.`);
    return [];
  }

  const jobsStart = workflow.search(/^jobs:\s*$/m);
  if (jobsStart < 0) {
    errors.push(`${path} is missing its jobs mapping.`);
    return [];
  }

  const jobsText = workflow.slice(jobsStart);
  const starts = [...jobsText.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)];
  return starts.map((match, index) => ({
    name: match[1],
    path,
    text: jobsText.slice(match.index, starts[index + 1]?.index ?? jobsText.length),
  }));
}

function indentation(line) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function workflowSteps(job) {
  const lines = job.text.split(/\r?\n/);
  const stepsIndex = lines.findIndex((line) => /^\s+steps:\s*(?:#.*)?$/.test(line));
  if (stepsIndex < 0) {
    return [];
  }

  const stepsIndent = indentation(lines[stepsIndex]);
  const stepsLines = lines.slice(stepsIndex + 1);
  const firstStepLine = stepsLines.find((line) => line.trim() && !/^\s*#/.test(line));
  if (
    !firstStepLine ||
    indentation(firstStepLine) <= stepsIndent ||
    !/^\s*-\s+/.test(firstStepLine)
  ) {
    return [];
  }

  const stepIndent = indentation(firstStepLine);
  const steps = [];
  let current = null;

  for (const line of stepsLines) {
    const isCommentOrBlank = !line.trim() || /^\s*#/.test(line);
    if (!isCommentOrBlank && indentation(line) <= stepsIndent) {
      break;
    }
    if (indentation(line) === stepIndent && /^\s*-\s+/.test(line)) {
      if (current) {
        steps.push(current);
      }
      current = { indent: stepIndent, lines: [line] };
    } else if (!isCommentOrBlank && indentation(line) < stepIndent) {
      return [];
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    steps.push(current);
  }
  return steps;
}

function directStepFieldValues(step, field) {
  const fieldIndent = step.indent + 2;
  const escapedField = field.replaceAll('-', '\\-');
  const pattern = new RegExp(`^\\s{${fieldIndent}}${escapedField}:\\s*(.*?)\\s*$`);
  const values = [];

  const firstLine = step.lines[0].slice(step.indent).replace(/^-\s+/, '');
  const firstMatch = firstLine.match(new RegExp(`^${escapedField}:\\s*(.*?)\\s*$`));
  if (firstMatch) {
    values.push(firstMatch[1]);
  }

  for (const line of step.lines.slice(1)) {
    const match = line.match(pattern);
    if (match) {
      values.push(match[1]);
    }
  }
  return values;
}

function setupJavaVersionValues(step) {
  const fieldIndent = step.indent + 2;
  const valueIndent = fieldIndent + 2;
  const values = [];

  for (let index = 0; index < step.lines.length; index += 1) {
    if (!new RegExp(`^\\s{${fieldIndent}}with:\\s*(?:#.*)?$`).test(step.lines[index])) {
      continue;
    }

    for (const line of step.lines.slice(index + 1)) {
      if (line.trim() && indentation(line) <= fieldIndent) {
        break;
      }
      const match = line.match(new RegExp(`^\\s{${valueIndent}}java-version:\\s*(.*?)\\s*$`));
      if (match) {
        values.push(match[1]);
      }
    }
  }
  return values;
}

function yamlScalar(value) {
  const quoted = value.match(/^(['"])(.*?)\1\s*(?:#.*)?$/);
  if (quoted) {
    return quoted[2];
  }
  return value.match(/^([^\s#]+)\s*(?:#.*)?$/)?.[1] ?? null;
}

function javaVersions(job, errors) {
  const setupJavaSteps = workflowSteps(job).filter((step) =>
    directStepFieldValues(step, 'uses').some((value) => {
      const action = yamlScalar(value);
      return action !== null && /^actions\/setup-java@[^\s#]+$/.test(action);
    }),
  );
  const requiredUpdate =
    `Update ${job.path} job ${job.name} to contain one actions/setup-java step with exactly ` +
    `one literal with.java-version: '21', then rerun check:android-toolchain and preserve the hosted Android CI evidence.`;

  if (setupJavaSteps.length !== 1) {
    errors.push(
      `${job.path} job ${job.name} must contain exactly one actions/setup-java step; found ${setupJavaSteps.length}. ${requiredUpdate}`,
    );
    return [];
  }

  const values = setupJavaVersionValues(setupJavaSteps[0]);
  if (values.length !== 1) {
    errors.push(
      `${job.path} job ${job.name} actions/setup-java must declare with.java-version exactly once; found ${values.length}. ${requiredUpdate}`,
    );
    return [];
  }

  const version = yamlScalar(values[0]);
  if (version === null || /\$\{\{/.test(version)) {
    errors.push(
      `${job.path} job ${job.name} actions/setup-java with.java-version must be the literal value 21; found nonliteral value ${JSON.stringify(values[0])}. ${requiredUpdate}`,
    );
    return [];
  }
  if (version !== '21') {
    errors.push(
      `${job.path} job ${job.name} actions/setup-java with.java-version must be the literal value 21; found ${JSON.stringify(version)}. ${requiredUpdate}`,
    );
  }
  return [version];
}

function parseRelevantWorkflowJobs(workflows, errors) {
  const allJobs = workflows.flatMap(({ path, content }) => workflowJobs(content, path, errors));
  const relevantJobs = allJobs.filter(
    (job) =>
      /^\s{4}runs-on:\s*(?:ubuntu|macos|windows)-/m.test(job.text) &&
      (/\.\/gradlew\b/.test(job.text) || /\bcap sync android\b/.test(job.text)),
  );

  if (relevantJobs.length === 0) {
    errors.push('No hosted Android build/test jobs were found in the canonical workflows.');
  }

  return relevantJobs.map((job) => {
    const platforms = sortedUnique(
      [...job.text.matchAll(/platforms;android-(\d+)/g)].map((match) => Number(match[1])),
    );
    const ndks = sortedUnique([...job.text.matchAll(/ndk;([0-9.]+)/g)].map((match) => match[1]));
    const configuredJavaVersions = javaVersions(job, errors);

    if (platforms.length === 0) {
      errors.push(`${job.path} job ${job.name} does not explicitly provision an Android SDK platform.`);
    }
    if (ndks.length === 0) {
      errors.push(`${job.path} job ${job.name} does not explicitly provision an Android NDK.`);
    }
    return { ...job, platforms, ndks, javaVersions: configuredJavaVersions };
  });
}

export function validateAndroidToolchainMatrix(files = {}) {
  const errors = [];
  const catalog = parseCatalog(files.catalog, errors);
  const compileSdk = parseCompileSdk(files.appBuild, errors);
  const gradle = parseGradleWrapper(files.wrapper, errors);
  const jobs = parseRelevantWorkflowJobs(
    [
      { path: ANDROID_TOOLCHAIN_PATHS.ciWorkflow, content: files.ciWorkflow },
      { path: ANDROID_TOOLCHAIN_PATHS.releaseWorkflow, content: files.releaseWorkflow },
    ],
    errors,
  );

  const baseline = jobs[0];
  for (const job of jobs) {
    if (compileSdk !== null && (job.platforms.length !== 1 || job.platforms[0] !== compileSdk)) {
      errors.push(
        `${job.path} job ${job.name} provisions SDK platform(s) ${describeSet(job.platforms)}; app compileSdk is ${compileSdk}.`,
      );
    }
    if (
      baseline &&
      (JSON.stringify(job.platforms) !== JSON.stringify(baseline.platforms) ||
        JSON.stringify(job.ndks) !== JSON.stringify(baseline.ndks))
    ) {
      errors.push(
        `${job.path} job ${job.name} diverges from ${baseline.path} job ${baseline.name}: ` +
          `SDK platforms ${describeSet(job.platforms)} vs ${describeSet(baseline.platforms)}, ` +
          `NDKs ${describeSet(job.ndks)} vs ${describeSet(baseline.ndks)}.`,
      );
    }
  }

  return {
    errors,
    matrix: {
      compileSdk,
      sdkPlatforms: baseline?.platforms ?? [],
      ndks: baseline?.ndks ?? [],
      java: baseline?.javaVersions ?? [],
      gradle,
      catalogVersions: catalog.versions,
      hostedJobs: jobs.map((job) => `${job.path}:${job.name}`),
    },
  };
}

export function readAndroidToolchainFiles(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  return Object.fromEntries(
    Object.entries(ANDROID_TOOLCHAIN_PATHS).map(([key, path]) => [
      key,
      readFileSync(resolve(repositoryRoot, path), 'utf8'),
    ]),
  );
}

export function runAndroidToolchainMatrixCheck(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  let files;
  try {
    files = readAndroidToolchainFiles(repositoryRoot);
  } catch (error) {
    throw new Error(
      `Android toolchain matrix check could not read its canonical inputs: ${error instanceof Error ? error.message : String(error)}.\n` +
        'Action: update the canonical matrix evidence and hosted validation together when changing the Android toolchain.',
      { cause: error },
    );
  }

  const { errors, matrix } = validateAndroidToolchainMatrix(files);
  if (errors.length > 0) {
    throw new Error(
      [
        'Android toolchain matrix check failed:',
        ...errors.map((error) => `- ${error}`),
        'Action: update the canonical matrix evidence and every relevant hosted Android validation job together when changing compileSdk, SDK/NDK provisioning, Java, catalog plugins, or the Gradle wrapper.',
        'Scope: this source-level guard checks repository coherence only; it does not prove device, StrongBox, Play Integrity, signing, or release qualification.',
      ].join('\n'),
    );
  }

  return [
    'Android toolchain matrix check passed:',
    `- compileSdk / hosted SDK platform: ${matrix.compileSdk}`,
    `- hosted NDK set: ${describeSet(matrix.ndks)}`,
    `- Java: ${describeSet(matrix.java)}`,
    `- Gradle wrapper: ${matrix.gradle} (reported as matrix evidence; no repository compatibility rule is asserted)`,
    `- catalog: AGP ${matrix.catalogVersions.agp}, Kotlin ${matrix.catalogVersions.kotlin}, KSP ${matrix.catalogVersions.ksp}, Compose BOM ${matrix.catalogVersions['compose-bom']}`,
    `- hosted validation jobs: ${matrix.hostedJobs.join(', ')}`,
  ].join('\n');
}

function main() {
  const repositoryRoot = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_REPOSITORY_ROOT;
  try {
    console.log(runAndroidToolchainMatrixCheck(repositoryRoot));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
