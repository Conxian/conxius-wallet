import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import * as ecc from 'tiny-secp256k1';

const K_MAX = 2_323;
const DEFAULT_WARMUPS = 5;
const DEFAULT_SAMPLES = 11;
const DEFAULT_ITERATIONS = 250;
const CHECKSUM_OFFSET = 0x811c9dc5;
const CHECKSUM_PRIME = 0x01000193;

function parseArgs(argv) {
    const args = {
        fixture: 'benchmarks/silent-payments/fixture.json',
        warmups: DEFAULT_WARMUPS,
        samples: DEFAULT_SAMPLES,
        iterations: DEFAULT_ITERATIONS,
        workload: null,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument.startsWith('--')) {
            throw new Error(`unexpected argument: ${argument}`);
        }
        const [name, inlineValue] = argument.split('=', 2);
        const value = inlineValue ?? argv[++index];
        if (value == null) {
            throw new Error(`missing value for ${name}`);
        }
        if (name === '--fixture') args.fixture = value;
        else if (name === '--warmups') args.warmups = positiveInteger(value, name, true);
        else if (name === '--samples') args.samples = positiveInteger(value, name, true);
        else if (name === '--iterations') args.iterations = positiveInteger(value, name, true);
        else if (name === '--workload') args.workload = value;
        else throw new Error(`unknown argument: ${name}`);
    }

    if (args.samples < 11) throw new Error('--samples must be at least 11');
    return args;
}

function positiveInteger(value, name, allowZero = false) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || (allowZero ? parsed < 0 : parsed < 1)) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

function bytesFromHex(value, name, expectedLength = null) {
    if (typeof value !== 'string' || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
        throw new Error(`${name} must be hexadecimal`);
    }
    const bytes = Buffer.from(value, 'hex');
    if (expectedLength != null && bytes.length !== expectedLength) {
        throw new Error(`${name} must contain ${expectedLength} bytes`);
    }
    return bytes;
}

function taggedHash(tag, message) {
    const tagHash = createHash('sha256').update(tag).digest();
    return createHash('sha256')
        .update(Buffer.concat([tagHash, tagHash, Buffer.from(message)]))
        .digest();
}

function u32Be(value) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value >>> 0);
    return bytes;
}

function u32Le(value) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(value >>> 0);
    return bytes;
}

function parseOutpoint(value, name) {
    if (!value || typeof value !== 'object') throw new Error(`${name} must be an object`);
    const txidLe = bytesFromHex(value.txid_le_hex, `${name}.txid_le_hex`, 32);
    if (!Number.isInteger(value.vout) || value.vout < 0 || value.vout > 0xffffffff) {
        throw new Error(`${name}.vout must be a uint32`);
    }
    return { txidLe, vout: value.vout };
}

function serializeOutpoint(outpoint) {
    return Buffer.concat([outpoint.txidLe, u32Le(outpoint.vout)]);
}

function compareOutpoints(left, right) {
    return Buffer.compare(serializeOutpoint(left), serializeOutpoint(right));
}

function xOnlyPointFromOutput(outputKey) {
    if (!ecc.isXOnlyPoint(outputKey)) throw new Error('fixture output key is not an x-only point');
    return Buffer.concat([Buffer.from([0x02]), outputKey]);
}

function negateCompressed(point) {
    if (point.length !== 33 || (point[0] !== 0x02 && point[0] !== 0x03)) {
        throw new Error('fixture point is not a compressed point');
    }
    return Buffer.concat([Buffer.from([point[0] === 0x02 ? 0x03 : 0x02]), point.subarray(1)]);
}

function combinePoints(points) {
    if (points.length === 0) return null;
    let result = points[0];
    for (const point of points.slice(1)) {
        result = Buffer.from(ecc.pointAdd(result, point, true) ?? fail('input public-key sum at infinity'));
    }
    return result;
}

function fail(message) {
    throw new Error(message);
}

function parseFixtureTransaction(transaction) {
    const allInputOutpoints = transaction.all_input_outpoints.map((outpoint, index) => (
        parseOutpoint(outpoint, `${transaction.id}.all_input_outpoints[${index}]`)
    ));
    const eligibleInputs = transaction.eligible_inputs.map((input, index) => {
        if (!Number.isInteger(input.input_index)
            || input.input_index < 0
            || input.input_index >= allInputOutpoints.length) {
            throw new Error(`${transaction.id}.eligible_inputs[${index}] has an invalid input_index`);
        }
        const publicKey = bytesFromHex(input.public_key_hex, `${transaction.id}.eligible_inputs[${index}].public_key_hex`);
        if (input.public_key_kind === 'compressed') {
            if (!ecc.isPointCompressed(publicKey)) throw new Error(`${transaction.id} has an invalid compressed input key`);
        } else if (input.public_key_kind === 'xonly') {
            if (!ecc.isXOnlyPoint(publicKey)) throw new Error(`${transaction.id} has an invalid x-only input key`);
        } else {
            throw new Error(`${transaction.id} has an unknown input key kind`);
        }
        return {
            outpoint: allInputOutpoints[input.input_index],
            publicKey,
            publicKeyKind: input.public_key_kind,
        };
    });
    const outputs = transaction.outputs.map((output, index) => {
        const outputKey = bytesFromHex(output.output_key_hex, `${transaction.id}.outputs[${index}].output_key_hex`, 32);
        if (!ecc.isXOnlyPoint(outputKey)) throw new Error(`${transaction.id} has an invalid output key`);
        return {
            outputKey,
            outpoint: parseOutpoint(output.outpoint, `${transaction.id}.outputs[${index}].outpoint`),
            valueSat: output.value_sat,
            isUnspent: output.is_unspent,
        };
    });

    return {
        id: transaction.id,
        allInputOutpoints,
        eligibleInputs,
        outputs,
        labels: transaction.labels ?? [],
        expectedStopReason: transaction.expected_stop_reason,
        expectedMatches: transaction.expected_matches ?? [],
    };
}

function parseFixture(fixture) {
    if (fixture.schema_version !== 1) throw new Error('unsupported benchmark fixture schema');
    const scanSecret = bytesFromHex(fixture.receiver.scan_secret_hex, 'receiver.scan_secret_hex', 32);
    const spendPublicKey = bytesFromHex(fixture.receiver.spend_public_key_hex, 'receiver.spend_public_key_hex', 33);
    if (!ecc.isPrivate(scanSecret)) throw new Error('fixture scan secret is not a valid scalar');
    if (!ecc.isPointCompressed(spendPublicKey)) throw new Error('fixture spend key is invalid');
    const workloads = fixture.workloads.map((workload) => ({
        name: workload.name,
        thresholdX: workload.threshold_x,
        transactions: workload.transactions.map(parseFixtureTransaction),
    }));
    return { scanSecret, spendPublicKey, workloads };
}

function inputPublicPoint(input) {
    if (input.publicKeyKind === 'compressed') return input.publicKey;
    return Buffer.concat([Buffer.from([0x02]), input.publicKey]);
}

function scanTransaction(receiver, transaction) {
    if (transaction.eligibleInputs.length === 0) {
        return { type: 'skipped', reason: 'NO_ELIGIBLE_INPUTS', matches: [] };
    }

    const inputSum = combinePoints(transaction.eligibleInputs.map((input) => {
        const point = inputPublicPoint(input);
        if (!ecc.isPointCompressed(point)) throw new Error(`${transaction.id} has an invalid input point`);
        return point;
    }));
    if (inputSum == null) {
        return { type: 'skipped', reason: 'INPUT_PUBLIC_KEY_SUM_AT_INFINITY', matches: [] };
    }
    const lowestOutpoint = transaction.allInputOutpoints.reduce((lowest, candidate) => (
        compareOutpoints(candidate, lowest) < 0 ? candidate : lowest
    ));
    const inputHashMessage = Buffer.concat([
        serializeOutpoint(lowestOutpoint),
        inputSum,
    ]);
    const inputHash = taggedHash('BIP0352/Inputs', inputHashMessage);
    if (!ecc.isPrivate(inputHash)) throw new Error('fixture produced an invalid BIP-352 input hash');
    const inputTweak = Buffer.from(ecc.pointMultiply(inputSum, inputHash, true) ?? fail('input tweak failed'));
    const sharedSecret = Buffer.from(ecc.pointMultiply(inputTweak, receiver.scanSecret, true) ?? fail('ECDH failed'));

    const labelCandidates = new Map();
    for (const label of transaction.labels) {
        if (!Number.isInteger(label) || label < 0 || label > 0xffffffff) throw new Error('fixture label is not a uint32');
        const labelScalar = taggedHash('BIP0352/Label', Buffer.concat([receiver.scanSecret, u32Be(label)]));
        if (!ecc.isPrivate(labelScalar)) throw new Error(`fixture produced an invalid label scalar for ${label}`);
        const labelPoint = Buffer.from(ecc.pointFromScalar(labelScalar, true) ?? fail('label point failed'));
        labelCandidates.set(labelPoint.toString('hex'), label);
    }

    const parsedOutputs = transaction.outputs.map((output) => {
        if (!ecc.isXOnlyPoint(output.outputKey)) throw new Error(`${transaction.id} has an invalid output point`);
        return { ...output, point: xOnlyPointFromOutput(output.outputKey) };
    });
    const matchedOutputs = new Set();
    const matches = [];
    let stopReason = 'NO_MATCH';
    for (let k = 0; k < K_MAX; k += 1) {
        const tweak = taggedHash('BIP0352/SharedSecret', Buffer.concat([sharedSecret, u32Be(k)]));
        if (!ecc.isPrivate(tweak)) throw new Error(`fixture produced an invalid tweak for k=${k}`);
        const derivedKey = Buffer.from(ecc.pointAddScalar(receiver.spendPublicKey, tweak, true) ?? fail('derived output key failed'));
        const derivedXOnly = Buffer.from(ecc.xOnlyPointFromPoint(derivedKey));
        const derivedNegative = negateCompressed(derivedKey);
        let foundMatch = null;

        for (let outputIndex = 0; outputIndex < parsedOutputs.length; outputIndex += 1) {
            if (matchedOutputs.has(outputIndex)) continue;
            const output = parsedOutputs[outputIndex];
            if (Buffer.compare(derivedXOnly, output.outputKey) === 0) {
                foundMatch = {
                    outputIndex,
                    kind: 'UNLABELED',
                    labelIndex: null,
                    matchedNegatedOutputKey: false,
                };
                break;
            }
            if (labelCandidates.size === 0) continue;

            const labelPoint = ecc.pointAdd(output.point, derivedNegative, true);
            const labelIndex = labelPoint == null ? undefined : labelCandidates.get(Buffer.from(labelPoint).toString('hex'));
            if (labelIndex !== undefined) {
                foundMatch = {
                    outputIndex,
                    kind: 'LABEL',
                    labelIndex,
                    matchedNegatedOutputKey: false,
                };
                break;
            }

            const negatedOutput = negateCompressed(output.point);
            const negatedLabelPoint = ecc.pointAdd(negatedOutput, derivedNegative, true);
            const negatedLabelIndex = negatedLabelPoint == null
                ? undefined
                : labelCandidates.get(Buffer.from(negatedLabelPoint).toString('hex'));
            if (negatedLabelIndex !== undefined) {
                foundMatch = {
                    outputIndex,
                    kind: 'LABEL',
                    labelIndex: negatedLabelIndex,
                    matchedNegatedOutputKey: true,
                };
                break;
            }
        }

        if (foundMatch == null) {
            stopReason = 'NO_MATCH';
            break;
        }

        const output = parsedOutputs[foundMatch.outputIndex];
        matchedOutputs.add(foundMatch.outputIndex);
        matches.push({
            outputIndex: foundMatch.outputIndex,
            outputKey: output.outputKey,
            outpoint: output.outpoint,
            valueSat: output.valueSat,
            isUnspent: output.isUnspent,
            k,
            kind: foundMatch.kind,
            labelIndex: foundMatch.labelIndex,
            matchedNegatedOutputKey: foundMatch.matchedNegatedOutputKey,
        });

        if (matchedOutputs.size === parsedOutputs.length) {
            stopReason = 'NO_MATCH';
            break;
        }
    }

    if (matches.length < parsedOutputs.length && matches.length === K_MAX) {
        stopReason = 'REACHED_K_MAX';
    }
    return { type: 'scanned', stopReason, matches };
}

function canonicalMatches(transaction, outcome) {
    return outcome.matches.map((match) => ({
        transaction_id: transaction.id,
        output_index: match.outputIndex,
        output_key_hex: match.outputKey.toString('hex'),
        k: match.k,
        kind: match.kind,
        label_index: match.labelIndex,
        matched_negated_output_key: match.matchedNegatedOutputKey,
    }));
}

function assertCorrectness(transaction, outcome) {
    if (outcome.type === 'skipped') {
        if (transaction.expectedMatches.length !== 0) {
            throw new Error(`${transaction.id} skipped but has expected matches`);
        }
        return;
    }
    if (outcome.stopReason !== transaction.expectedStopReason) {
        throw new Error(`${transaction.id} stop reason mismatch: ${outcome.stopReason}`);
    }
    const actual = canonicalMatches(transaction, outcome);
    const expected = transaction.expectedMatches.map((match) => ({
        transaction_id: transaction.id,
        output_index: match.output_index,
        output_key_hex: match.output_key_hex.toLowerCase(),
        k: match.k,
        kind: match.kind,
        label_index: match.label_index,
        matched_negated_output_key: match.matched_negated_output_key,
    }));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${transaction.id} canonical match mismatch\nactual=${JSON.stringify(actual)}\nexpected=${JSON.stringify(expected)}`);
    }
    for (const match of outcome.matches) {
        const output = transaction.outputs[match.outputIndex];
        if (output == null || Buffer.compare(output.outputKey, match.outputKey) !== 0) {
            throw new Error(`${transaction.id} returned an invalid output identity`);
        }
    }
}

function checksumMix(checksum, value) {
    return Math.imul((checksum ^ (value >>> 0)) >>> 0, CHECKSUM_PRIME) >>> 0;
}

function checksumBytes(checksum, bytes) {
    let next = checksum;
    for (const byte of bytes) next = checksumMix(next, byte);
    return next;
}

function checksumForScan(checksum, transaction, outcome) {
    let next = checksumBytes(checksum, Buffer.from(transaction.id, 'utf8'));
    const stopCode = outcome.type === 'skipped'
        ? 2
        : outcome.stopReason === 'REACHED_K_MAX' ? 1 : 0;
    next = checksumMix(next, stopCode);
    next = checksumMix(next, outcome.matches.length);
    for (const match of outcome.matches) {
        next = checksumMix(next, match.outputIndex);
        next = checksumMix(next, match.k);
        next = checksumMix(next, match.outputKey.readUInt32BE(0));
        next = checksumMix(next, match.outpoint.vout);
        next = checksumMix(next, match.kind === 'LABEL' ? 1 : 0);
        next = checksumMix(next, match.labelIndex ?? 0);
        next = checksumMix(next, match.matchedNegatedOutputKey ? 1 : 0);
    }
    return next;
}

function runBenchmark(receiver, workload, options) {
    const transactions = workload.transactions;
    const expectedMatchesPerScan = transactions.reduce((total, transaction) => (
        total + transaction.expectedMatches.length
    ), 0);
    const canonicalResults = transactions.map((transaction) => {
        const outcome = scanTransaction(receiver, transaction);
        assertCorrectness(transaction, outcome);
        return {
            transaction_id: transaction.id,
            stop_reason: outcome.type === 'skipped' ? outcome.reason : outcome.stopReason,
            matches: canonicalMatches(transaction, outcome),
        };
    });

    let warmupChecksum = CHECKSUM_OFFSET;
    for (let warmup = 0; warmup < options.warmups; warmup += 1) {
        for (let iteration = 0; iteration < options.iterations; iteration += 1) {
            for (const transaction of transactions) {
                const outcome = scanTransaction(receiver, transaction);
                warmupChecksum = checksumForScan(warmupChecksum, transaction, outcome);
            }
        }
        globalThis.__silentPaymentsBenchSink = warmupChecksum;
    }

    const sampleNsPerScan = [];
    let checksum = CHECKSUM_OFFSET;
    let matchCount = 0;
    const scansPerSample = options.iterations * transactions.length;
    for (let sample = 0; sample < options.samples; sample += 1) {
        const start = process.hrtime.bigint();
        let sampleMatches = 0;
        for (let iteration = 0; iteration < options.iterations; iteration += 1) {
            for (const transaction of transactions) {
                const outcome = scanTransaction(receiver, transaction);
                checksum = checksumForScan(checksum, transaction, outcome);
                sampleMatches += outcome.matches.length;
            }
        }
        const elapsedNs = Number(process.hrtime.bigint() - start);
        sampleNsPerScan.push(elapsedNs / scansPerSample);
        matchCount += sampleMatches;
        globalThis.__silentPaymentsBenchSink = checksum;
    }

    const sorted = [...sampleNsPerScan].sort((left, right) => left - right);
    const medianNsPerScan = sorted[Math.floor(sorted.length / 2)];
    const meanNsPerScan = sampleNsPerScan.reduce((total, value) => total + value, 0) / sampleNsPerScan.length;
    return {
        name: workload.name,
        threshold_x: workload.thresholdX,
        warmups: options.warmups,
        samples: options.samples,
        iterations: options.iterations,
        transaction_count: transactions.length,
        scan_count: options.samples * scansPerSample,
        expected_match_count_per_scan: expectedMatchesPerScan,
        match_count: matchCount,
        checksum: `0x${checksum.toString(16).padStart(8, '0')}`,
        median_ns_per_scan: medianNsPerScan,
        mean_ns_per_scan: meanNsPerScan,
        throughput_scans_per_sec: 1e9 / medianNsPerScan,
        canonical_results: canonicalResults,
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const fixture = JSON.parse(readFileSync(resolve(options.fixture), 'utf8'));
    const parsedFixture = parseFixture(fixture);
    const workloads = options.workload == null
        ? parsedFixture.workloads
        : parsedFixture.workloads.filter((workload) => workload.name === options.workload);
    if (workloads.length === 0) throw new Error(`unknown workload: ${options.workload}`);
    const results = workloads.map((workload) => runBenchmark(parsedFixture, workload, options));
    console.log(JSON.stringify({
        runner: 'typescript-reference',
        implementation: 'Node.js + tiny-secp256k1 WASM',
        ...options,
        results,
    }));
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
}
