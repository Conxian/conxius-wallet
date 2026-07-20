use std::collections::BTreeSet;

use conxius_silent_payments::{
    scan_transaction, EligibleInput, EligibleInputPublicKey, MatchKind, OutPoint, ScanError,
    ScanOutcome, ScanSecret, ScanSkipReason, ScanStopReason, TaprootOutput, K_MAX,
};
use ripemd::Ripemd160;
use secp256k1::{PublicKey, Secp256k1, SecretKey};
use serde_json::Value;
use sha2::{Digest, Sha256};

const OFFICIAL_VECTORS: &str = include_str!("data/send_and_receive_test_vectors.json");

const NUMS_H: [u8; 32] = [
    0x50, 0x92, 0x9b, 0x74, 0xc1, 0xa0, 0x49, 0x54, 0xb7, 0x8b, 0x4b, 0x60, 0x35, 0xe9, 0x7a, 0x5e,
    0x07, 0x8a, 0x5a, 0x0f, 0x28, 0xec, 0x96, 0xd5, 0x47, 0xbf, 0xee, 0x9a, 0xce, 0x80, 0x3a, 0xc0,
];

fn string_field<'a>(object: &'a Value, field: &str) -> &'a str {
    object
        .get(field)
        .and_then(Value::as_str)
        .expect("official vector field must be a string")
}

fn fixed<const N: usize>(hex: &str) -> [u8; N] {
    assert_eq!(
        hex.len(),
        N * 2,
        "official vector byte field has wrong length"
    );
    let mut result = [0u8; N];
    for (index, byte) in hex.as_bytes().chunks_exact(2).enumerate() {
        result[index] = (hex_nibble(byte[0]) << 4) | hex_nibble(byte[1]);
    }
    result
}

fn hex_bytes(hex: &str) -> Vec<u8> {
    assert_eq!(hex.len() % 2, 0, "official vector hex field has odd length");
    hex.as_bytes()
        .chunks_exact(2)
        .map(|byte| (hex_nibble(byte[0]) << 4) | hex_nibble(byte[1]))
        .collect()
}

fn hex_nibble(byte: u8) -> u8 {
    match byte {
        b'0'..=b'9' => byte - b'0',
        b'a'..=b'f' => byte - b'a' + 10,
        b'A'..=b'F' => byte - b'A' + 10,
        _ => panic!("official vector contains a non-hex byte"),
    }
}

fn varint(bytes: &[u8], position: &mut usize) -> usize {
    let prefix = bytes[*position];
    *position += 1;
    match prefix {
        0..=0xfc => prefix as usize,
        0xfd => {
            let value = u16::from_le_bytes(bytes[*position..*position + 2].try_into().unwrap());
            *position += 2;
            value as usize
        }
        0xfe => {
            let value = u32::from_le_bytes(bytes[*position..*position + 4].try_into().unwrap());
            *position += 4;
            value as usize
        }
        0xff => {
            let value = u64::from_le_bytes(bytes[*position..*position + 8].try_into().unwrap());
            *position += 8;
            usize::try_from(value).unwrap()
        }
    }
}

fn witness_items(hex: &str) -> Vec<Vec<u8>> {
    if hex.is_empty() {
        return Vec::new();
    }
    let bytes = hex_bytes(hex);
    let mut position = 0;
    let item_count = varint(&bytes, &mut position);
    let mut items = Vec::with_capacity(item_count);
    for _ in 0..item_count {
        let length = varint(&bytes, &mut position);
        items.push(bytes[position..position + length].to_vec());
        position += length;
    }
    assert_eq!(
        position,
        bytes.len(),
        "official vector witness has trailing bytes"
    );
    items
}

fn compressed_key(bytes: &[u8]) -> Option<EligibleInputPublicKey> {
    if bytes.len() == 33 && matches!(bytes[0], 0x02 | 0x03) {
        let mut key = [0u8; 33];
        key.copy_from_slice(bytes);
        Some(EligibleInputPublicKey::Compressed(key))
    } else {
        None
    }
}

fn hash160(bytes: &[u8]) -> [u8; 20] {
    let sha256 = Sha256::digest(bytes);
    Ripemd160::digest(sha256).into()
}

fn input_public_key(vin: &Value) -> Option<EligibleInputPublicKey> {
    let previous_script = hex_bytes(string_field(&vin["prevout"]["scriptPubKey"], "hex"));
    let script_sig = hex_bytes(string_field(vin, "scriptSig"));
    let witness = witness_items(string_field(vin, "txinwitness"));

    if previous_script.len() == 25
        && previous_script.starts_with(&[0x76, 0xa9, 0x14])
        && previous_script.ends_with(&[0x88, 0xac])
    {
        let expected_hash = &previous_script[3..23];
        if script_sig.len() >= 33 {
            for start in (0..=script_sig.len() - 33).rev() {
                let candidate = &script_sig[start..start + 33];
                if compressed_key(candidate).is_some() && hash160(candidate) == expected_hash {
                    return compressed_key(candidate);
                }
            }
        }
    }

    if previous_script.len() == 23
        && previous_script.starts_with(&[0xa9, 0x14])
        && previous_script.ends_with(&[0x87])
    {
        let redeem_script = script_sig.get(1..).unwrap_or_default();
        if redeem_script.len() == 22 && redeem_script.starts_with(&[0x00, 0x14]) {
            return witness.last().and_then(|key| compressed_key(key));
        }
    }

    if previous_script.len() == 22 && previous_script.starts_with(&[0x00, 0x14]) {
        return witness.last().and_then(|key| compressed_key(key));
    }

    if previous_script.len() == 34 && previous_script.starts_with(&[0x51, 0x20]) {
        let mut witness_without_annex = witness;
        if witness_without_annex
            .last()
            .is_some_and(|item| item.first() == Some(&0x50))
        {
            witness_without_annex.pop();
        }
        if witness_without_annex.len() > 1 {
            let control_block = witness_without_annex.last().unwrap();
            if control_block.len() >= 33 && control_block[1..33] == NUMS_H {
                return None;
            }
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&previous_script[2..]);
        return Some(EligibleInputPublicKey::XOnly(key));
    }

    None
}

fn outpoint(vin: &Value) -> OutPoint {
    let mut txid_le = fixed::<32>(string_field(vin, "txid"));
    txid_le.reverse();
    OutPoint {
        txid_le,
        vout: vin["vout"].as_u64().expect("vout must be an integer") as u32,
    }
}

fn build_inputs(given: &Value) -> Vec<EligibleInput> {
    given["vin"]
        .as_array()
        .expect("official vector vin must be an array")
        .iter()
        .filter_map(|vin| {
            input_public_key(vin).map(|public_key| EligibleInput {
                outpoint: outpoint(vin),
                public_key,
            })
        })
        .collect()
}

fn all_input_outpoints(given: &Value) -> Vec<OutPoint> {
    given["vin"]
        .as_array()
        .expect("official vector vin must be an array")
        .iter()
        .map(outpoint)
        .collect()
}

fn build_outputs(given: &Value, case_index: usize) -> Vec<TaprootOutput> {
    given["outputs"]
        .as_array()
        .expect("official vector outputs must be an array")
        .iter()
        .enumerate()
        .map(|(output_index, output)| TaprootOutput {
            output_key: fixed::<32>(output.as_str().expect("output key must be a string")),
            outpoint: OutPoint {
                txid_le: [case_index as u8; 32],
                vout: output_index as u32,
            },
            value_sat: 1_000 + output_index as u64,
            is_unspent: true,
        })
        .collect()
}

fn expected_output_keys(expected: &Value) -> Vec<[u8; 32]> {
    expected
        .get("outputs")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|output| {
            output
                .get("pub_key")
                .and_then(Value::as_str)
                .or_else(|| output.as_str())
        })
        .map(fixed::<32>)
        .collect()
}

fn expected_match_count(expected: &Value, expected_keys: &[[u8; 32]]) -> usize {
    expected
        .get("n_outputs")
        .and_then(Value::as_u64)
        .map(|count| count as usize)
        .unwrap_or(expected_keys.len())
}

fn scan_secret(given: &Value) -> ScanSecret {
    ScanSecret::from_bytes(fixed::<32>(string_field(
        &given["key_material"],
        "scan_priv_key",
    )))
    .expect("official scan secret must be valid")
}

fn spend_public_key(given: &Value) -> [u8; 33] {
    let spend_secret = SecretKey::from_byte_array(&fixed::<32>(string_field(
        &given["key_material"],
        "spend_priv_key",
    )))
    .expect("official spend secret must be valid");
    PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret).serialize()
}

fn labels(given: &Value) -> Vec<u32> {
    given["labels"]
        .as_array()
        .expect("official labels must be an array")
        .iter()
        .map(|label| label.as_u64().expect("official label must be an integer") as u32)
        .collect()
}

fn sorted_keys(keys: impl IntoIterator<Item = [u8; 32]>) -> BTreeSet<[u8; 32]> {
    keys.into_iter().collect()
}

#[test]
fn official_bip352_receiving_vectors_match() {
    let vectors: Value = serde_json::from_str(OFFICIAL_VECTORS).expect("official vectors JSON");
    let cases = vectors.as_array().expect("official vectors array");
    let mut tested_receivers = 0usize;

    for (case_index, case) in cases.iter().enumerate() {
        let comment = string_field(case, "comment");
        let receiving = case["receiving"]
            .as_array()
            .expect("official receiving cases array");

        for receiver in receiving {
            tested_receivers += 1;
            let given = &receiver["given"];
            let expected = &receiver["expected"];
            let inputs = build_inputs(given);
            let outputs = build_outputs(given, case_index);
            let expected_keys = expected_output_keys(expected);
            let expected_count = expected_match_count(expected, &expected_keys);
            let outcome = scan_transaction(
                &scan_secret(given),
                spend_public_key(given),
                &all_input_outpoints(given),
                &inputs,
                &outputs,
                &labels(given),
            )
            .unwrap_or_else(|error| panic!("official case {case_index} failed: {error}"));

            match outcome {
                ScanOutcome::Skipped(reason) => {
                    assert!(
                        expected_count == 0,
                        "official case {case_index} ({comment}) unexpectedly skipped with {reason:?}"
                    );
                    assert!(matches!(
                        reason,
                        ScanSkipReason::NoEligibleInputs
                            | ScanSkipReason::InputPublicKeySumAtInfinity
                    ));
                }
                ScanOutcome::Scanned(report) => {
                    assert_eq!(
                        report.matches.len(),
                        expected_count,
                        "official case {case_index} ({comment}) match count"
                    );
                    if !expected_keys.is_empty() {
                        assert_eq!(
                            sorted_keys(report.matches.iter().map(|matched| matched.output_key)),
                            sorted_keys(expected_keys),
                            "official case {case_index} ({comment}) output keys"
                        );
                    }
                    if expected_count > 0 {
                        for matched in &report.matches {
                            let output = &outputs[matched.output_index];
                            assert_eq!(matched.outpoint, output.outpoint);
                            assert_eq!(matched.value_sat, output.value_sat);
                            assert_eq!(matched.is_unspent, output.is_unspent);
                            assert!(matched.k < K_MAX);
                            assert!(matches!(
                                matched.kind,
                                MatchKind::Unlabeled | MatchKind::Label { .. }
                            ));
                        }
                    }
                    if case_index == 27 {
                        assert_eq!(report.matches.len(), K_MAX as usize);
                        assert_eq!(report.stop_reason, ScanStopReason::ReachedKMax);
                        assert_eq!(report.matches.last().unwrap().k, K_MAX - 1);
                    } else {
                        assert_eq!(report.stop_reason, ScanStopReason::NoMatch);
                    }
                }
            }

            if case_index == 13 {
                let ScanOutcome::Scanned(report) = scan_transaction(
                    &scan_secret(given),
                    spend_public_key(given),
                    &all_input_outpoints(given),
                    &inputs,
                    &outputs,
                    &labels(given),
                )
                .expect("official odd-parity label case") else {
                    panic!("official odd-parity label case was skipped");
                };
                assert!(report
                    .matches
                    .iter()
                    .any(|matched| matched.matched_negated_output_key));
            }
        }
    }

    assert_eq!(tested_receivers, 29);
}

#[test]
fn malformed_public_records_fail_closed_without_secret_bearing_errors() {
    let scan_secret = ScanSecret::from_bytes([1u8; 32]).expect("test scan secret");
    let spend_secret = SecretKey::from_byte_array(&[2u8; 32]).expect("test spend secret");
    let spend_public_key = PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret).serialize();
    let input = EligibleInput {
        outpoint: OutPoint {
            txid_le: [3u8; 32],
            vout: 0,
        },
        public_key: EligibleInputPublicKey::Compressed([0u8; 33]),
    };
    let output = TaprootOutput {
        output_key: [0u8; 32],
        outpoint: OutPoint {
            txid_le: [4u8; 32],
            vout: 0,
        },
        value_sat: 1,
        is_unspent: true,
    };

    assert_eq!(
        scan_transaction(
            &scan_secret,
            spend_public_key,
            &[input.outpoint],
            &[input],
            &[],
            &[],
        ),
        Err(ScanError::InvalidInputPublicKey(0))
    );
    let valid_input = EligibleInput {
        outpoint: OutPoint {
            txid_le: [5u8; 32],
            vout: 0,
        },
        public_key: EligibleInputPublicKey::Compressed(spend_public_key),
    };
    assert_eq!(
        scan_transaction(
            &scan_secret,
            spend_public_key,
            &[valid_input.outpoint],
            &[valid_input],
            &[output],
            &[],
        ),
        Err(ScanError::InvalidOutputKey(0))
    );
    assert_eq!(
        ScanSecret::from_bytes([0u8; 32]).unwrap_err(),
        ScanError::InvalidScanSecret
    );
}
