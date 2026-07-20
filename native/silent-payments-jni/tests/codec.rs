use conxius_silent_payments::{
    scan_transaction, EligibleInput, EligibleInputPublicKey, MatchKind, OutPoint, ScanOutcome,
    ScanSecret, TaprootOutput,
};
use conxius_silent_payments_jni::{
    decode_public_batch, decode_scan_result, encode_public_batch, encode_scan_result,
    scan_public_batch, BatchMetrics, DecodedResult, Network, PublicBatch, PublicMatch,
    PublicScanResult, PublicTransaction,
};
use secp256k1::{PublicKey, Secp256k1, SecretKey};
use serde_json::Value;

const OFFICIAL_VECTORS: &str =
    include_str!("../../silent-payments/tests/data/send_and_receive_test_vectors.json");
const PUBLIC_FIXTURE_PASSPHRASE: &[u8] = &[0x54, 0x52, 0x45, 0x5a, 0x4f, 0x52];

fn hex_nibble(byte: u8) -> u8 {
    match byte {
        b'0'..=b'9' => byte - b'0',
        b'a'..=b'f' => byte - b'a' + 10,
        b'A'..=b'F' => byte - b'A' + 10,
        _ => panic!("invalid fixture hex"),
    }
}

fn hex_bytes(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| (hex_nibble(pair[0]) << 4) | hex_nibble(pair[1]))
        .collect()
}

fn fixed<const N: usize>(value: &str) -> [u8; N] {
    hex_bytes(value).try_into().expect("fixed fixture length")
}

fn outpoint(txid_be: &str, vout: u32) -> OutPoint {
    let mut txid_le = fixed::<32>(txid_be);
    txid_le.reverse();
    OutPoint { txid_le, vout }
}

fn sample_batch() -> PublicBatch {
    let outpoint = OutPoint {
        txid_le: [7u8; 32],
        vout: 1,
    };
    let spend_secret = SecretKey::from_byte_array(&[2u8; 32]).expect("fixture secret");
    let spend_public_key = PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret).serialize();
    PublicBatch {
        network: Network::Testnet,
        account: 0,
        start_block: 100,
        end_block: 101,
        labels: vec![0, 7],
        transactions: vec![PublicTransaction {
            block_height: 100,
            transaction_index: 3,
            all_input_outpoints: vec![outpoint],
            eligible_inputs: vec![EligibleInput {
                outpoint,
                public_key: EligibleInputPublicKey::Compressed(spend_public_key),
            }],
            outputs: vec![TaprootOutput {
                output_key: [8u8; 32],
                outpoint,
                value_sat: 42,
                is_unspent: true,
            }],
        }],
    }
}

#[test]
fn public_batch_round_trip_preserves_structured_records() {
    let batch = sample_batch();
    let encoded = encode_public_batch(&batch).expect("encode sample batch");
    assert_eq!(
        decode_public_batch(&encoded).expect("decode sample batch"),
        batch
    );
}

#[test]
fn native_scan_derives_keys_and_returns_only_public_metrics() {
    let batch = PublicBatch {
        network: Network::Testnet,
        account: 0,
        start_block: 100,
        end_block: 100,
        labels: vec![],
        transactions: vec![PublicTransaction {
            block_height: 100,
            transaction_index: 0,
            all_input_outpoints: vec![],
            eligible_inputs: vec![],
            outputs: vec![],
        }],
    };
    let encoded = encode_public_batch(&batch).expect("encode bounded empty transaction");
    let result = scan_public_batch(
        b"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        PUBLIC_FIXTURE_PASSPHRASE,
        &encoded,
    )
    .expect("derive and scan fixture");
    assert!(result.matches.is_empty());
    assert_eq!(result.metrics.transaction_count, 1);
    assert_eq!(result.metrics.scanned_transaction_count, 0);
    assert_eq!(result.metrics.skipped_transaction_count, 1);
    assert_eq!(result.metrics.batch_bytes, encoded.len() as u32);
}

#[test]
fn malformed_and_truncated_batches_fail_closed() {
    let encoded = encode_public_batch(&sample_batch()).expect("encode sample batch");
    for length in 0..encoded.len() {
        assert!(
            decode_public_batch(&encoded[..length]).is_err(),
            "truncated public batch length {length} unexpectedly decoded"
        );
    }

    let mut invalid_network = encoded.clone();
    invalid_network[5] = 0xff;
    assert_eq!(
        decode_public_batch(&invalid_network),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidNetwork)
    );

    let mut too_many_transactions = b"SPB1".to_vec();
    too_many_transactions.extend_from_slice(&[1, Network::Mainnet.code()]);
    too_many_transactions.extend_from_slice(&0u32.to_le_bytes());
    too_many_transactions.extend_from_slice(&0u64.to_le_bytes());
    too_many_transactions.extend_from_slice(&0u64.to_le_bytes());
    too_many_transactions.extend_from_slice(
        &((conxius_silent_payments_jni::MAX_BATCH_TRANSACTIONS + 1) as u32).to_le_bytes(),
    );
    too_many_transactions.extend_from_slice(&0u32.to_le_bytes());
    assert_eq!(
        decode_public_batch(&too_many_transactions),
        Err(conxius_silent_payments_jni::NativeErrorCode::ResourceLimit)
    );
}

#[test]
fn result_error_and_truncation_mapping_is_stable() {
    let error = vec![b'S', b'P', b'R', b'1', 1, 1];
    assert_eq!(
        decode_scan_result(&error).expect("decode stable error"),
        DecodedResult::Error(conxius_silent_payments_jni::NativeErrorCode::InvalidSecret)
    );
    assert!(decode_scan_result(&error[..error.len() - 1]).is_err());

    let result = PublicScanResult {
        metrics: BatchMetrics {
            transaction_count: 1,
            scanned_transaction_count: 1,
            skipped_transaction_count: 0,
            match_count: 1,
            elapsed_micros: 12,
            batch_bytes: 44,
        },
        matches: vec![PublicMatch {
            block_height: 100,
            transaction_index: 0,
            scan_match: conxius_silent_payments::ScanMatch {
                output_index: 0,
                output_key: [9u8; 32],
                outpoint: OutPoint {
                    txid_le: [10u8; 32],
                    vout: 0,
                },
                value_sat: 123,
                is_unspent: true,
                k: 4,
                kind: MatchKind::Label { index: 7 },
                matched_negated_output_key: false,
            },
        }],
    };
    let encoded = encode_scan_result(&result);
    assert_eq!(
        decode_scan_result(&encoded).expect("decode result"),
        DecodedResult::Success(result)
    );
    for length in 0..encoded.len() {
        assert!(decode_scan_result(&encoded[..length]).is_err());
    }
}

#[test]
fn official_vector_public_batch_and_result_round_trip() {
    let vectors: Value = serde_json::from_str(OFFICIAL_VECTORS).expect("official vectors JSON");
    let given = &vectors[0]["receiving"][0]["given"];
    let sending_expected = &vectors[0]["sending"][0]["expected"];

    let all_input_outpoints: Vec<OutPoint> = given["vin"]
        .as_array()
        .expect("official vin")
        .iter()
        .map(|vin| {
            outpoint(
                vin["txid"].as_str().expect("txid"),
                vin["vout"].as_u64().unwrap() as u32,
            )
        })
        .collect();
    let input_public_keys = sending_expected["input_pub_keys"]
        .as_array()
        .expect("input keys");
    let eligible_inputs = input_public_keys
        .iter()
        .enumerate()
        .map(|(index, public_key)| EligibleInput {
            outpoint: all_input_outpoints[index],
            public_key: EligibleInputPublicKey::Compressed(fixed::<33>(
                public_key.as_str().unwrap(),
            )),
        })
        .collect();
    let output_key = fixed::<32>(given["outputs"][0].as_str().unwrap());
    let output_outpoint = OutPoint {
        txid_le: [0x55; 32],
        vout: 0,
    };
    let batch = PublicBatch {
        network: Network::Mainnet,
        account: 0,
        start_block: 900_000,
        end_block: 900_000,
        labels: vec![],
        transactions: vec![PublicTransaction {
            block_height: 900_000,
            transaction_index: 0,
            all_input_outpoints,
            eligible_inputs,
            outputs: vec![TaprootOutput {
                output_key,
                outpoint: output_outpoint,
                value_sat: 50_000,
                is_unspent: true,
            }],
        }],
    };
    let encoded_batch = encode_public_batch(&batch).expect("encode official public batch");
    let decoded_batch = decode_public_batch(&encoded_batch).expect("decode official public batch");

    let scan_secret = ScanSecret::from_bytes(fixed::<32>(
        given["key_material"]["scan_priv_key"].as_str().unwrap(),
    ))
    .expect("official scan secret");
    let spend_secret = SecretKey::from_byte_array(&fixed::<32>(
        given["key_material"]["spend_priv_key"].as_str().unwrap(),
    ))
    .expect("official spend secret");
    let spend_public_key = PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret).serialize();
    let outcome = scan_transaction(
        &scan_secret,
        spend_public_key,
        &decoded_batch.transactions[0].all_input_outpoints,
        &decoded_batch.transactions[0].eligible_inputs,
        &decoded_batch.transactions[0].outputs,
        &decoded_batch.labels,
    )
    .expect("official vector scan");
    let report = match outcome {
        ScanOutcome::Scanned(report) => report,
        ScanOutcome::Skipped(reason) => panic!("official vector unexpectedly skipped: {reason:?}"),
    };
    assert_eq!(report.matches.len(), 1);
    assert_eq!(report.matches[0].output_key, output_key);

    let result = PublicScanResult {
        metrics: BatchMetrics {
            transaction_count: 1,
            scanned_transaction_count: 1,
            skipped_transaction_count: 0,
            match_count: 1,
            elapsed_micros: 0,
            batch_bytes: encoded_batch.len() as u32,
        },
        matches: vec![PublicMatch {
            block_height: decoded_batch.transactions[0].block_height,
            transaction_index: decoded_batch.transactions[0].transaction_index,
            scan_match: report.matches[0],
        }],
    };
    let encoded_result = encode_scan_result(&result);
    assert_eq!(
        decode_scan_result(&encoded_result).expect("official result round trip"),
        DecodedResult::Success(result)
    );
}
