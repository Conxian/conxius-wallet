use conxius_silent_payments::{
    scan_transaction, EligibleInput, EligibleInputPublicKey, MatchKind, OutPoint, ScanOutcome,
    ScanSecret, TaprootOutput, MAX_LABELS, MAX_TAPROOT_OUTPUTS,
};
use conxius_silent_payments_jni::{
    decode_public_batch, decode_scan_result, encode_public_batch, encode_scan_result,
    scan_public_batch, BatchMetrics, DecodedResult, Network, PublicBatch, PublicMatch,
    PublicScanResult, PublicTransaction,
};
use secp256k1::{PublicKey, Secp256k1, SecretKey};
use serde_json::Value;
use sha2::{Digest, Sha256};

const OFFICIAL_VECTORS: &str =
    include_str!("../../silent-payments/tests/data/send_and_receive_test_vectors.json");
const PUBLIC_FIXTURE_PASSPHRASE: &[u8] = &[0x54, 0x52, 0x45, 0x5a, 0x4f, 0x52];
const CODEC_FIXTURE: &str = include_str!(
    "../../../android/core-bitcoin/src/test/resources/silent-payments-codec-fixtures.json"
);

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

fn hex_encode(value: &[u8]) -> String {
    value.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn sample_result(batch: &PublicBatch) -> PublicScanResult {
    let transaction = &batch.transactions[0];
    PublicScanResult {
        metrics: BatchMetrics {
            transaction_count: 1,
            scanned_transaction_count: 1,
            skipped_transaction_count: 0,
            match_count: 1,
            elapsed_micros: 12,
            batch_bytes: encode_public_batch(batch)
                .expect("encode sample batch")
                .len() as u32,
        },
        matches: vec![PublicMatch {
            transaction_id: transaction.transaction_id,
            block_height: transaction.block_height,
            transaction_index: transaction.transaction_index,
            scan_match: conxius_silent_payments::ScanMatch {
                output_index: 0,
                output_key: transaction.outputs[0].output_key,
                outpoint: transaction.outputs[0].outpoint,
                value_sat: transaction.outputs[0].value_sat,
                is_unspent: transaction.outputs[0].is_unspent,
                k: 4,
                kind: MatchKind::Label { index: 7 },
                matched_negated_output_key: false,
            },
        }],
    }
}

fn tagged_hash(tag: &[u8], message: &[u8]) -> [u8; 32] {
    let tag_hash = Sha256::digest(tag);
    let mut hasher = Sha256::new();
    hasher.update(tag_hash);
    hasher.update(tag_hash);
    hasher.update(message);
    hasher.finalize().into()
}

fn derived_output_key(
    scan_secret: &[u8; 32],
    spend_public_key: [u8; 33],
    input_outpoint: OutPoint,
    input_public_key: [u8; 33],
    k: u32,
) -> [u8; 32] {
    let secp = Secp256k1::new();
    let input_public_key = PublicKey::from_byte_array_compressed(&input_public_key).unwrap();
    let input_hash = tagged_hash(
        b"BIP0352/Inputs",
        &[
            input_outpoint.serialize().as_slice(),
            input_public_key.serialize().as_slice(),
        ]
        .concat(),
    );
    let input_hash = secp256k1::Scalar::from_be_bytes(input_hash).unwrap();
    let first_ecdh = input_public_key.mul_tweak(&secp, &input_hash).unwrap();
    let scan_scalar = secp256k1::Scalar::from_be_bytes(*scan_secret).unwrap();
    let ecdh_point = first_ecdh.mul_tweak(&secp, &scan_scalar).unwrap();
    let mut tweak_message = Vec::with_capacity(37);
    tweak_message.extend_from_slice(&ecdh_point.serialize());
    tweak_message.extend_from_slice(&k.to_be_bytes());
    let tweak =
        secp256k1::Scalar::from_be_bytes(tagged_hash(b"BIP0352/SharedSecret", &tweak_message))
            .unwrap();
    PublicKey::from_byte_array_compressed(&spend_public_key)
        .unwrap()
        .add_exp_tweak(&secp, &tweak)
        .unwrap()
        .x_only_public_key()
        .0
        .serialize()
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
    let transaction_id = [6u8; 32];
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
            transaction_id,
            block_height: 100,
            transaction_index: 3,
            all_input_outpoints: vec![outpoint],
            eligible_inputs: vec![EligibleInput {
                outpoint,
                public_key: EligibleInputPublicKey::Compressed(spend_public_key),
            }],
            outputs: vec![TaprootOutput {
                output_key: [8u8; 32],
                outpoint: OutPoint {
                    txid_le: transaction_id,
                    vout: 0,
                },
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
fn checked_in_codec_fixture_is_byte_for_byte_stable() {
    let fixture: Value = serde_json::from_str(CODEC_FIXTURE).expect("codec fixture JSON");
    let batch = sample_batch();
    let encoded_batch = encode_public_batch(&batch).expect("encode fixture batch");
    let result = sample_result(&batch);
    let encoded_result = encode_scan_result(&result);
    assert_eq!(hex_encode(&encoded_batch), fixture["batch_hex"]);
    assert_eq!(hex_encode(&encoded_result), fixture["result_hex"]);
    assert_eq!(decode_public_batch(&encoded_batch).unwrap(), batch);
    assert_eq!(
        decode_scan_result(&encoded_result).unwrap(),
        DecodedResult::Success(result)
    );
}

#[test]
fn validation_rejects_duplicate_public_records_and_malformed_results() {
    let mut duplicate_transaction = sample_batch();
    duplicate_transaction
        .transactions
        .push(duplicate_transaction.transactions[0].clone());
    assert_eq!(
        encode_public_batch(&duplicate_transaction),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidPublicRecord)
    );

    let mut duplicate_input = sample_batch();
    duplicate_input.transactions[0]
        .all_input_outpoints
        .push(OutPoint {
            txid_le: [7u8; 32],
            vout: 1,
        });
    assert_eq!(
        encode_public_batch(&duplicate_input),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidPublicRecord)
    );

    let mut mismatched_output_txid = sample_batch();
    mismatched_output_txid.transactions[0].outputs[0]
        .outpoint
        .txid_le = [9u8; 32];
    assert_eq!(
        encode_public_batch(&mismatched_output_txid),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidPublicRecord)
    );

    let batch = sample_batch();
    let result = sample_result(&batch);
    let encoded_result = encode_scan_result(&result);
    let mut duplicate_result = encoded_result.clone();
    duplicate_result[18..22].copy_from_slice(&2u32.to_le_bytes());
    duplicate_result[34..38].copy_from_slice(&2u32.to_le_bytes());
    duplicate_result.extend_from_slice(&encoded_result[38..]);
    assert_eq!(
        decode_scan_result(&duplicate_result),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidPublicRecord)
    );

    let mut invalid_k = encoded_result.clone();
    invalid_k[163..167].copy_from_slice(&conxius_silent_payments_jni::MAX_K.to_le_bytes());
    assert_eq!(
        decode_scan_result(&invalid_k),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidPublicRecord)
    );

    let mut signed_long_overflow = encode_public_batch(&batch).unwrap();
    signed_long_overflow[17] |= 0x80;
    assert_eq!(
        decode_public_batch(&signed_long_overflow),
        Err(conxius_silent_payments_jni::NativeErrorCode::InvalidPublicBatch)
    );
}

#[test]
fn public_batch_adapter_derives_keys_and_returns_public_matches() {
    let transaction_id = [6u8; 32];
    let input_outpoint = OutPoint {
        txid_le: [7u8; 32],
        vout: 1,
    };
    let input_secret = SecretKey::from_byte_array(&[2u8; 32]).expect("fixture input secret");
    let input_public_key = PublicKey::from_secret_key(&Secp256k1::new(), &input_secret).serialize();
    let derived = conxius_silent_payments_jni::derive_receiver_keys(
        b"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        PUBLIC_FIXTURE_PASSPHRASE,
        Network::Testnet,
        0,
    )
    .expect("derive fixture receiver keys");
    let output_key = derived_output_key(
        &derived.scan_secret,
        derived.spend_public_key,
        input_outpoint,
        input_public_key,
        0,
    );
    let batch = PublicBatch {
        network: Network::Testnet,
        account: 0,
        start_block: 100,
        end_block: 100,
        labels: vec![],
        transactions: vec![PublicTransaction {
            transaction_id,
            block_height: 100,
            transaction_index: 0,
            all_input_outpoints: vec![input_outpoint],
            eligible_inputs: vec![EligibleInput {
                outpoint: input_outpoint,
                public_key: EligibleInputPublicKey::Compressed(input_public_key),
            }],
            outputs: vec![TaprootOutput {
                output_key,
                outpoint: OutPoint {
                    txid_le: transaction_id,
                    vout: 0,
                },
                value_sat: 42,
                is_unspent: true,
            }],
        }],
    };
    let encoded = encode_public_batch(&batch).expect("encode derived-key batch");
    let result = scan_public_batch(
        b"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        PUBLIC_FIXTURE_PASSPHRASE,
        &encoded,
    )
    .expect("derive and scan fixture");
    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].transaction_id, transaction_id);
    assert_eq!(result.matches[0].scan_match.k, 0);
    assert_eq!(result.metrics.transaction_count, 1);
    assert_eq!(result.metrics.scanned_transaction_count, 1);
    assert_eq!(result.metrics.skipped_transaction_count, 0);
    assert_eq!(result.metrics.batch_bytes, encoded.len() as u32);
}

#[test]
fn public_batch_adapter_rejects_pathological_ecc_work_before_secret_derivation() {
    let transaction_id = [11u8; 32];
    let input_outpoint = OutPoint {
        txid_le: [12u8; 32],
        vout: 0,
    };
    let input_secret = SecretKey::from_byte_array(&[2u8; 32]).expect("fixture input secret");
    let input_public_key = PublicKey::from_secret_key(&Secp256k1::new(), &input_secret).serialize();
    let outputs: Vec<_> = (0..MAX_TAPROOT_OUTPUTS)
        .map(|vout| TaprootOutput {
            output_key: [0u8; 32],
            outpoint: OutPoint {
                txid_le: transaction_id,
                vout: vout as u32,
            },
            value_sat: 0,
            is_unspent: false,
        })
        .collect();
    let batch = PublicBatch {
        network: Network::Testnet,
        account: 0,
        start_block: 100,
        end_block: 100,
        labels: (0..MAX_LABELS as u32).collect(),
        transactions: vec![PublicTransaction {
            transaction_id,
            block_height: 100,
            transaction_index: 0,
            all_input_outpoints: vec![input_outpoint],
            eligible_inputs: vec![EligibleInput {
                outpoint: input_outpoint,
                public_key: EligibleInputPublicKey::Compressed(input_public_key),
            }],
            outputs,
        }],
    };
    let encoded = encode_public_batch(&batch).expect("encode budget fixture");

    assert_eq!(
        scan_public_batch(
            b"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
            b"",
            &encoded,
        ),
        Err(conxius_silent_payments_jni::NativeErrorCode::ResourceLimit)
    );
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
    too_many_transactions.extend_from_slice(&[2, Network::Mainnet.code()]);
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
    let error = vec![b'S', b'P', b'R', b'1', 2, 1];
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
            transaction_id: [10u8; 32],
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
fn official_bip352_core_vector_adapter_is_separate_from_jni_e2e() {
    // The official fixture contains independent BIP-352 key material rather than a mnemonic.
    // This deliberately exercises the platform-neutral core adapter, not the JNI export. The
    // mnemonic-derived public-batch path is covered by public_batch_adapter_* above.
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
            transaction_id: [0x55; 32],
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
            transaction_id: decoded_batch.transactions[0].transaction_id,
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
