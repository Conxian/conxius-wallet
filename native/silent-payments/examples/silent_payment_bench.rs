use std::{env, fs, hint::black_box, time::Instant};

use conxius_silent_payments::{
    scan_transaction, EligibleInput, EligibleInputPublicKey, MatchKind, OutPoint, ScanOutcome,
    ScanSecret, ScanStopReason, TaprootOutput,
};
use serde::Deserialize;
use serde_json::{json, Value};

const DEFAULT_WARMUPS: usize = 5;
const DEFAULT_SAMPLES: usize = 11;
const DEFAULT_ITERATIONS: usize = 250;
const CHECKSUM_OFFSET: u32 = 0x811c9dc5;
const CHECKSUM_PRIME: u32 = 0x01000193;

#[derive(Debug)]
struct Options {
    fixture: String,
    warmups: usize,
    samples: usize,
    iterations: usize,
    workload: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Fixture {
    schema_version: u32,
    receiver: ReceiverFixture,
    workloads: Vec<WorkloadFixture>,
}

#[derive(Debug, Deserialize)]
struct ReceiverFixture {
    scan_secret_hex: String,
    spend_public_key_hex: String,
}

#[derive(Debug, Deserialize)]
struct WorkloadFixture {
    name: String,
    threshold_x: f64,
    transactions: Vec<TransactionFixture>,
}

#[derive(Debug, Deserialize)]
struct TransactionFixture {
    id: String,
    all_input_outpoints: Vec<OutPointFixture>,
    eligible_inputs: Vec<EligibleInputFixture>,
    outputs: Vec<OutputFixture>,
    labels: Vec<u32>,
    expected_stop_reason: String,
    expected_matches: Vec<ExpectedMatchFixture>,
}

#[derive(Debug, Deserialize)]
struct OutPointFixture {
    txid_le_hex: String,
    vout: u32,
}

#[derive(Debug, Deserialize)]
struct EligibleInputFixture {
    input_index: usize,
    public_key_kind: String,
    public_key_hex: String,
}

#[derive(Debug, Deserialize)]
struct OutputFixture {
    output_key_hex: String,
    outpoint: OutPointFixture,
    value_sat: u64,
    is_unspent: bool,
}

#[derive(Clone, Debug, Deserialize)]
struct ExpectedMatchFixture {
    output_index: usize,
    output_key_hex: String,
    k: u32,
    kind: String,
    label_index: Option<u32>,
    matched_negated_output_key: bool,
}

struct PreparedTransaction {
    id: String,
    all_input_outpoints: Vec<OutPoint>,
    inputs: Vec<EligibleInput>,
    outputs: Vec<TaprootOutput>,
    labels: Vec<u32>,
    expected_stop_reason: String,
    expected_matches: Vec<ExpectedMatchFixture>,
}

struct PreparedFixture {
    scan_secret: ScanSecret,
    spend_public_key: [u8; 33],
    workloads: Vec<(String, f64, Vec<PreparedTransaction>)>,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let options = parse_options(env::args().skip(1).collect())?;
    let fixture: Fixture = serde_json::from_str(
        &fs::read_to_string(&options.fixture)
            .map_err(|error| format!("read fixture {}: {error}", options.fixture))?,
    )
    .map_err(|error| format!("parse fixture: {error}"))?;
    let prepared = prepare_fixture(fixture)?;
    let workloads = prepared
        .workloads
        .iter()
        .filter(|(name, _, _)| match options.workload.as_deref() {
            None => true,
            Some(wanted) => wanted == name,
        })
        .map(|(name, threshold_x, transactions)| {
            benchmark_workload(
                &prepared.scan_secret,
                prepared.spend_public_key,
                name,
                *threshold_x,
                transactions,
                &options,
            )
        })
        .collect::<Result<Vec<_>, _>>()?;

    if workloads.is_empty() {
        return Err(format!(
            "unknown workload: {}",
            options.workload.as_deref().unwrap_or("<none>")
        ));
    }

    let output = json!({
        "runner": "rust-production-core",
        "implementation": "Rust secp256k1 (libsecp256k1 backend)",
        "fixture": options.fixture,
        "warmups": options.warmups,
        "samples": options.samples,
        "iterations": options.iterations,
        "workload": options.workload,
        "results": workloads,
    });
    println!(
        "{}",
        serde_json::to_string(&output).map_err(|error| format!("serialize result: {error}"))?
    );
    Ok(())
}

fn parse_options(arguments: Vec<String>) -> Result<Options, String> {
    let mut options = Options {
        fixture: "benchmarks/silent-payments/fixture.json".to_owned(),
        warmups: DEFAULT_WARMUPS,
        samples: DEFAULT_SAMPLES,
        iterations: DEFAULT_ITERATIONS,
        workload: None,
    };
    let mut index = 0;
    while index < arguments.len() {
        let argument = &arguments[index];
        if !argument.starts_with("--") {
            return Err(format!("unexpected argument: {argument}"));
        }
        let (name, inline_value) = argument
            .split_once('=')
            .map_or((argument.as_str(), None), |(name, value)| {
                (name, Some(value))
            });
        let value = if let Some(value) = inline_value {
            value.to_owned()
        } else {
            index += 1;
            arguments
                .get(index)
                .cloned()
                .ok_or_else(|| format!("missing value for {name}"))?
        };
        match name {
            "--fixture" => options.fixture = value,
            "--warmups" => options.warmups = parse_count(&value, name, true)?,
            "--samples" => options.samples = parse_count(&value, name, false)?,
            "--iterations" => options.iterations = parse_count(&value, name, false)?,
            "--workload" => options.workload = Some(value),
            _ => return Err(format!("unknown argument: {name}")),
        }
        index += 1;
    }
    if options.samples < 11 {
        return Err("--samples must be at least 11".to_owned());
    }
    Ok(options)
}

fn parse_count(value: &str, name: &str, allow_zero: bool) -> Result<usize, String> {
    let parsed = value
        .parse::<usize>()
        .map_err(|_| format!("{name} must be a positive integer"))?;
    if !allow_zero && parsed == 0 {
        return Err(format!("{name} must be a positive integer"));
    }
    Ok(parsed)
}

fn prepare_fixture(fixture: Fixture) -> Result<PreparedFixture, String> {
    if fixture.schema_version != 1 {
        return Err("unsupported benchmark fixture schema".to_owned());
    }
    let scan_secret = ScanSecret::from_bytes(hex_fixed::<32>(
        &fixture.receiver.scan_secret_hex,
        "receiver.scan_secret_hex",
    )?)
    .map_err(|error| format!("invalid receiver scan secret: {error}"))?;
    let spend_public_key = hex_fixed::<33>(
        &fixture.receiver.spend_public_key_hex,
        "receiver.spend_public_key_hex",
    )?;
    let workloads = fixture
        .workloads
        .into_iter()
        .map(|workload| {
            let transactions = workload
                .transactions
                .iter()
                .map(prepare_transaction)
                .collect::<Result<Vec<_>, _>>()?;
            Ok((workload.name, workload.threshold_x, transactions))
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(PreparedFixture {
        scan_secret,
        spend_public_key,
        workloads,
    })
}

fn prepare_transaction(transaction: &TransactionFixture) -> Result<PreparedTransaction, String> {
    let all_input_outpoints = transaction
        .all_input_outpoints
        .iter()
        .enumerate()
        .map(|(index, outpoint)| {
            prepare_outpoint(
                outpoint,
                &format!("{}.all_input_outpoints[{index}]", transaction.id),
            )
        })
        .collect::<Result<Vec<_>, _>>()?;
    let inputs = transaction
        .eligible_inputs
        .iter()
        .enumerate()
        .map(|(index, input)| {
            let outpoint = *all_input_outpoints.get(input.input_index).ok_or_else(|| {
                format!(
                    "{}.eligible_inputs[{index}] has invalid input_index {}",
                    transaction.id, input.input_index
                )
            })?;
            let public_key = match input.public_key_kind.as_str() {
                "compressed" => EligibleInputPublicKey::Compressed(hex_fixed::<33>(
                    &input.public_key_hex,
                    &format!("{}.eligible_inputs[{index}].public_key_hex", transaction.id),
                )?),
                "xonly" => EligibleInputPublicKey::XOnly(hex_fixed::<32>(
                    &input.public_key_hex,
                    &format!("{}.eligible_inputs[{index}].public_key_hex", transaction.id),
                )?),
                kind => {
                    return Err(format!(
                        "{}.eligible_inputs[{index}] has unknown key kind {kind}",
                        transaction.id
                    ));
                }
            };
            Ok(EligibleInput {
                outpoint,
                public_key,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let outputs = transaction
        .outputs
        .iter()
        .enumerate()
        .map(|(index, output)| {
            Ok(TaprootOutput {
                output_key: hex_fixed::<32>(
                    &output.output_key_hex,
                    &format!("{}.outputs[{index}].output_key_hex", transaction.id),
                )?,
                outpoint: prepare_outpoint(
                    &output.outpoint,
                    &format!("{}.outputs[{index}].outpoint", transaction.id),
                )?,
                value_sat: output.value_sat,
                is_unspent: output.is_unspent,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(PreparedTransaction {
        id: transaction.id.clone(),
        all_input_outpoints,
        inputs,
        outputs,
        labels: transaction.labels.clone(),
        expected_stop_reason: transaction.expected_stop_reason.clone(),
        expected_matches: transaction.expected_matches.clone(),
    })
}

fn prepare_outpoint(value: &OutPointFixture, name: &str) -> Result<OutPoint, String> {
    Ok(OutPoint {
        txid_le: hex_fixed::<32>(&value.txid_le_hex, &format!("{name}.txid_le_hex"))?,
        vout: value.vout,
    })
}

fn benchmark_workload(
    scan_secret: &ScanSecret,
    spend_public_key: [u8; 33],
    name: &str,
    threshold_x: f64,
    transactions: &[PreparedTransaction],
    options: &Options,
) -> Result<Value, String> {
    let canonical_results = transactions
        .iter()
        .map(|transaction| {
            let outcome = scan(transaction, scan_secret, spend_public_key)?;
            assert_correctness(transaction, &outcome)?;
            Ok(canonical_result(transaction, &outcome))
        })
        .collect::<Result<Vec<_>, String>>()?;

    let mut warmup_checksum = CHECKSUM_OFFSET;
    for _ in 0..options.warmups {
        for _ in 0..options.iterations {
            for transaction in transactions {
                let outcome = scan(transaction, scan_secret, spend_public_key)?;
                warmup_checksum = checksum_for_scan(warmup_checksum, transaction, &outcome);
                black_box(&outcome);
            }
        }
        black_box(warmup_checksum);
    }

    let scans_per_sample = options
        .iterations
        .checked_mul(transactions.len())
        .ok_or_else(|| "scan count overflow".to_owned())?;
    let mut sample_ns_per_scan = Vec::with_capacity(options.samples);
    let mut checksum = CHECKSUM_OFFSET;
    let mut match_count = 0usize;
    for _ in 0..options.samples {
        let start = Instant::now();
        let mut sample_matches = 0usize;
        for _ in 0..options.iterations {
            for transaction in transactions {
                let outcome = scan(transaction, scan_secret, spend_public_key)?;
                checksum = checksum_for_scan(checksum, transaction, &outcome);
                sample_matches += match_count_for_outcome(&outcome);
                black_box(&outcome);
            }
        }
        let elapsed_ns = start.elapsed().as_nanos() as f64;
        sample_ns_per_scan.push(elapsed_ns / scans_per_sample as f64);
        match_count += sample_matches;
        black_box(checksum);
    }
    let mut sorted = sample_ns_per_scan.clone();
    sorted.sort_by(f64::total_cmp);
    let median_ns_per_scan = sorted[sorted.len() / 2];
    let mean_ns_per_scan = sample_ns_per_scan.iter().sum::<f64>() / sample_ns_per_scan.len() as f64;
    let expected_match_count_per_scan = transactions
        .iter()
        .map(|transaction| transaction.expected_matches.len())
        .sum::<usize>();
    let scan_count = options
        .samples
        .checked_mul(scans_per_sample)
        .ok_or_else(|| "timed scan count overflow".to_owned())?;

    Ok(json!({
        "name": name,
        "threshold_x": threshold_x,
        "warmups": options.warmups,
        "samples": options.samples,
        "iterations": options.iterations,
        "transaction_count": transactions.len(),
        "scan_count": scan_count,
        "expected_match_count_per_scan": expected_match_count_per_scan,
        "match_count": match_count,
        "checksum": format!("0x{checksum:08x}"),
        "median_ns_per_scan": median_ns_per_scan,
        "mean_ns_per_scan": mean_ns_per_scan,
        "throughput_scans_per_sec": 1_000_000_000.0 / median_ns_per_scan,
        "canonical_results": canonical_results,
    }))
}

fn scan(
    transaction: &PreparedTransaction,
    scan_secret: &ScanSecret,
    spend_public_key: [u8; 33],
) -> Result<ScanOutcome, String> {
    scan_transaction(
        scan_secret,
        spend_public_key,
        &transaction.all_input_outpoints,
        &transaction.inputs,
        &transaction.outputs,
        &transaction.labels,
    )
    .map_err(|error| format!("{} scan failed: {error}", transaction.id))
}

fn assert_correctness(
    transaction: &PreparedTransaction,
    outcome: &ScanOutcome,
) -> Result<(), String> {
    let ScanOutcome::Scanned(report) = outcome else {
        if transaction.expected_matches.is_empty() {
            return Ok(());
        }
        return Err(format!(
            "{} skipped but has expected matches",
            transaction.id
        ));
    };
    if stop_reason_name(report.stop_reason) != transaction.expected_stop_reason {
        return Err(format!(
            "{} stop reason mismatch: {}",
            transaction.id,
            stop_reason_name(report.stop_reason)
        ));
    }
    if report.matches.len() != transaction.expected_matches.len() {
        return Err(format!(
            "{} match count mismatch: actual {}, expected {}",
            transaction.id,
            report.matches.len(),
            transaction.expected_matches.len()
        ));
    }
    for (actual, expected) in report.matches.iter().zip(&transaction.expected_matches) {
        let expected_key = hex_fixed::<32>(
            &expected.output_key_hex,
            &format!("{}.expected_matches.output_key_hex", transaction.id),
        )?;
        let expected_kind = match expected.kind.as_str() {
            "UNLABELED" => MatchKind::Unlabeled,
            "LABEL" => MatchKind::Label {
                index: expected
                    .label_index
                    .ok_or_else(|| format!("{} label match has no label index", transaction.id))?,
            },
            kind => {
                return Err(format!(
                    "{} has unknown expected match kind {kind}",
                    transaction.id
                ))
            }
        };
        if actual.output_index != expected.output_index
            || actual.output_key != expected_key
            || actual.k != expected.k
            || actual.kind != expected_kind
            || actual.matched_negated_output_key != expected.matched_negated_output_key
        {
            return Err(format!(
                "{} canonical match mismatch at k={}: actual {:?}, expected output index {}",
                transaction.id, expected.k, actual, expected.output_index
            ));
        }
        let output = transaction
            .outputs
            .get(actual.output_index)
            .ok_or_else(|| format!("{} returned an invalid output index", transaction.id))?;
        if actual.outpoint != output.outpoint
            || actual.value_sat != output.value_sat
            || actual.is_unspent != output.is_unspent
        {
            return Err(format!(
                "{} returned invalid output metadata",
                transaction.id
            ));
        }
    }
    Ok(())
}

fn canonical_result(transaction: &PreparedTransaction, outcome: &ScanOutcome) -> Value {
    let (stop_reason, matches) = match outcome {
        ScanOutcome::Skipped(reason) => (skip_reason_name(*reason), Vec::new()),
        ScanOutcome::Scanned(report) => (
            stop_reason_name(report.stop_reason),
            report
                .matches
                .iter()
                .map(|matched| {
                    json!({
                        "transaction_id": transaction.id,
                        "output_index": matched.output_index,
                        "output_key_hex": hex_string(&matched.output_key),
                        "k": matched.k,
                        "kind": match matched.kind { MatchKind::Unlabeled => "UNLABELED", MatchKind::Label { .. } => "LABEL" },
                        "label_index": match matched.kind { MatchKind::Unlabeled => None, MatchKind::Label { index } => Some(index) },
                        "matched_negated_output_key": matched.matched_negated_output_key,
                    })
                })
                .collect(),
        ),
    };
    json!({
        "transaction_id": transaction.id,
        "stop_reason": stop_reason,
        "matches": matches,
    })
}

fn match_count_for_outcome(outcome: &ScanOutcome) -> usize {
    match outcome {
        ScanOutcome::Skipped(_) => 0,
        ScanOutcome::Scanned(report) => report.matches.len(),
    }
}

fn checksum_for_scan(
    mut checksum: u32,
    transaction: &PreparedTransaction,
    outcome: &ScanOutcome,
) -> u32 {
    checksum = checksum_bytes(checksum, transaction.id.as_bytes());
    let (stop_code, matches) = match outcome {
        ScanOutcome::Skipped(_) => (2, &[][..]),
        ScanOutcome::Scanned(report) => (
            if report.stop_reason == ScanStopReason::ReachedKMax {
                1
            } else {
                0
            },
            report.matches.as_slice(),
        ),
    };
    checksum = checksum_mix(checksum, stop_code);
    checksum = checksum_mix(checksum, matches.len() as u32);
    for matched in matches {
        checksum = checksum_mix(checksum, matched.output_index as u32);
        checksum = checksum_mix(checksum, matched.k);
        checksum = checksum_mix(
            checksum,
            u32::from_be_bytes(matched.output_key[..4].try_into().unwrap()),
        );
        checksum = checksum_mix(checksum, matched.outpoint.vout);
        let (kind_code, label_index) = match matched.kind {
            MatchKind::Unlabeled => (0, 0),
            MatchKind::Label { index } => (1, index),
        };
        checksum = checksum_mix(checksum, kind_code);
        checksum = checksum_mix(checksum, label_index);
        checksum = checksum_mix(checksum, u32::from(matched.matched_negated_output_key));
    }
    checksum
}

fn checksum_mix(checksum: u32, value: u32) -> u32 {
    (checksum ^ value).wrapping_mul(CHECKSUM_PRIME)
}

fn checksum_bytes(mut checksum: u32, bytes: &[u8]) -> u32 {
    for &byte in bytes {
        checksum = checksum_mix(checksum, u32::from(byte));
    }
    checksum
}

fn stop_reason_name(reason: ScanStopReason) -> &'static str {
    match reason {
        ScanStopReason::NoMatch => "NO_MATCH",
        ScanStopReason::ReachedKMax => "REACHED_K_MAX",
    }
}

fn skip_reason_name(reason: conxius_silent_payments::ScanSkipReason) -> &'static str {
    match reason {
        conxius_silent_payments::ScanSkipReason::NoEligibleInputs => "NO_ELIGIBLE_INPUTS",
        conxius_silent_payments::ScanSkipReason::InputPublicKeySumAtInfinity => {
            "INPUT_PUBLIC_KEY_SUM_AT_INFINITY"
        }
    }
}

fn hex_fixed<const N: usize>(value: &str, name: &str) -> Result<[u8; N], String> {
    if value.len() != N * 2 || !value.as_bytes().chunks_exact(2).remainder().is_empty() {
        return Err(format!("{name} must contain {N} bytes"));
    }
    let mut bytes = [0u8; N];
    for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        bytes[index] = (hex_nibble(pair[0])? << 4) | hex_nibble(pair[1])?;
    }
    Ok(bytes)
}

fn hex_nibble(value: u8) -> Result<u8, String> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        b'A'..=b'F' => Ok(value - b'A' + 10),
        _ => Err("fixture contains non-hex data".to_owned()),
    }
}

fn hex_string(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut result = String::with_capacity(bytes.len() * 2);
    for &byte in bytes {
        result.push(HEX[(byte >> 4) as usize] as char);
        result.push(HEX[(byte & 0x0f) as usize] as char);
    }
    result
}
