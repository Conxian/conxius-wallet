import { execFileSync, spawnSync } from 'node:child_process';
import { cpus, platform, arch } from 'node:os';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_WARMUPS = 5;
const DEFAULT_SAMPLES = 11;
const DEFAULT_ITERATIONS = 250;
const DEFAULT_THRESHOLD_X = 2.0;
const MAIN_WORKLOADS = new Set(['unlabeled-no-match', 'multi-match']);

function parseArgs(argv) {
    const args = {
        fixture: resolve(ROOT, 'benchmarks/silent-payments/fixture.json'),
        warmups: DEFAULT_WARMUPS,
        samples: DEFAULT_SAMPLES,
        iterations: DEFAULT_ITERATIONS,
        thresholdX: Number(process.env.SILENT_PAYMENTS_BENCH_THRESHOLD_X ?? DEFAULT_THRESHOLD_X),
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--') continue;
        if (!argument.startsWith('--')) throw new Error(`unexpected argument: ${argument}`);
        const [name, inlineValue] = argument.split('=', 2);
        const value = inlineValue ?? argv[++index];
        if (value == null) throw new Error(`missing value for ${name}`);
        if (name === '--fixture') args.fixture = resolve(ROOT, value);
        else if (name === '--warmups') args.warmups = count(value, name, true);
        else if (name === '--samples') args.samples = count(value, name, false);
        else if (name === '--iterations') args.iterations = count(value, name, false);
        else if (name === '--threshold' || name === '--threshold-x') args.thresholdX = finiteNumber(value, name);
        else throw new Error(`unknown argument: ${name}`);
    }
    if (args.samples < 11) throw new Error('--samples must be at least 11');
    if (!Number.isFinite(args.thresholdX) || args.thresholdX < 0) {
        throw new Error('--threshold must be a finite non-negative number');
    }
    return args;
}

function count(value, name, allowZero) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || (allowZero ? parsed < 0 : parsed < 1)) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

function finiteNumber(value, name) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
    return parsed;
}

function run(command, arguments_, label) {
    const result = spawnSync(command, arguments_, {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
    if (result.status !== 0) {
        throw new Error(`${label} exited with ${result.status}\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
}

function parseRunnerOutput(output, label) {
    const lines = output.trim().split('\n').filter(Boolean);
    const jsonLine = lines.at(-1);
    if (!jsonLine) throw new Error(`${label} emitted no JSON`);
    try {
        return JSON.parse(jsonLine);
    } catch (error) {
        throw new Error(`${label} emitted invalid JSON: ${error.message}\n${jsonLine}`);
    }
}

function commandMetadata() {
    const version = (command, arguments_) => {
        try {
            return execFileSync(command, arguments_, { cwd: ROOT, encoding: 'utf8' }).trim().split('\n')[0];
        } catch {
            return 'unavailable';
        }
    };
    let gitHead = 'unavailable';
    try {
        gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
        // Metadata collection must not hide benchmark results.
    }
    let tinySecpVersion = 'unavailable';
    try {
        tinySecpVersion = JSON.parse(readFileSync(resolve(ROOT, 'node_modules/tiny-secp256k1/package.json'), 'utf8')).version;
    } catch {
        // The TS runner will fail if the dependency is actually unavailable.
    }
    return {
        generated_at_utc: new Date().toISOString(),
        platform: `${platform()}-${arch()}`,
        cpu: cpus()[0]?.model ?? 'unknown',
        node: process.version,
        rustc: version('rustc', ['-V']),
        cargo: version('cargo', ['-V']),
        tiny_secp256k1: tinySecpVersion,
        git_head: gitHead,
    };
}

function compareCanonicalResults(left, right) {
    const normalize = (value) => {
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
        }
        return value;
    };
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const rustBinary = resolve(ROOT, 'native/silent-payments/target/release/examples/silent_payment_bench');
    run('cargo', [
        'build',
        '--quiet',
        '--release',
        '--manifest-path',
        'native/silent-payments/Cargo.toml',
        '--example',
        'silent_payment_bench',
    ], 'Rust release build');

    const runnerArguments = [
        '--fixture', options.fixture,
        '--warmups', String(options.warmups),
        '--samples', String(options.samples),
        '--iterations', String(options.iterations),
    ];
    const rust = parseRunnerOutput(run(rustBinary, runnerArguments, 'Rust benchmark'), 'Rust benchmark');
    const typescript = parseRunnerOutput(
        run(process.execPath, ['benchmarks/silent-payments/ts-bench.mjs', ...runnerArguments], 'TypeScript benchmark'),
        'TypeScript benchmark',
    );

    if (rust.results.length !== typescript.results.length) {
        throw new Error('Rust and TypeScript returned different workload counts');
    }
    const workloads = rust.results.map((rustResult) => {
        const tsResult = typescript.results.find((candidate) => candidate.name === rustResult.name);
        if (!tsResult) throw new Error(`TypeScript result missing workload ${rustResult.name}`);
        const canonicalEqual = compareCanonicalResults(rustResult.canonical_results, tsResult.canonical_results);
        const checksumEqual = rustResult.checksum === tsResult.checksum;
        const countEqual = rustResult.match_count === tsResult.match_count
            && rustResult.scan_count === tsResult.scan_count
            && rustResult.expected_match_count_per_scan === tsResult.expected_match_count_per_scan;
        if (!canonicalEqual || !checksumEqual || !countEqual) {
            throw new Error(`cross-runner correctness mismatch for ${rustResult.name}`);
        }
        const speedupX = tsResult.median_ns_per_scan / rustResult.median_ns_per_scan;
        const thresholdChecked = MAIN_WORKLOADS.has(rustResult.name);
        const thresholdPassed = !thresholdChecked || speedupX >= options.thresholdX;
        return {
            name: rustResult.name,
            threshold_x: rustResult.threshold_x,
            correctness: {
                canonical_results_equal: canonicalEqual,
                checksum_equal: checksumEqual,
                counts_equal: countEqual,
                checksum: rustResult.checksum,
            },
            rust: {
                median_ns_per_scan: rustResult.median_ns_per_scan,
                mean_ns_per_scan: rustResult.mean_ns_per_scan,
                throughput_scans_per_sec: rustResult.throughput_scans_per_sec,
                match_count: rustResult.match_count,
            },
            typescript: {
                median_ns_per_scan: tsResult.median_ns_per_scan,
                mean_ns_per_scan: tsResult.mean_ns_per_scan,
                throughput_scans_per_sec: tsResult.throughput_scans_per_sec,
                match_count: tsResult.match_count,
            },
            speedup_x: speedupX,
            threshold: {
                checked: thresholdChecked,
                required_x: options.thresholdX,
                passed: thresholdPassed,
            },
            canonical_results: rustResult.canonical_results,
        };
    });

    const thresholdFailures = workloads
        .filter((workload) => workload.threshold.checked && !workload.threshold.passed)
        .map((workload) => ({
            name: workload.name,
            observed_x: workload.speedup_x,
            required_x: workload.threshold.required_x,
        }));
    const output = {
        schema_version: 1,
        command: 'pnpm bench:silent-payments -- --warmups 5 --samples 11 --iterations 250',
        config: {
            fixture: options.fixture,
            warmups: options.warmups,
            samples: options.samples,
            iterations: options.iterations,
            threshold_x: options.thresholdX,
        },
        machine: commandMetadata(),
        runners: {
            rust: rust.implementation,
            typescript: typescript.implementation,
        },
        workloads,
        threshold_failures: thresholdFailures,
        threshold_passed: thresholdFailures.length === 0,
    };
    console.log(JSON.stringify(output));
    if (thresholdFailures.length > 0) process.exitCode = 1;
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
}
