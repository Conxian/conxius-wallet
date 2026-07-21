use std::collections::HashSet;

use conxius_silent_payments::{
    scan_transaction, EligibleInput, EligibleInputPublicKey, MatchKind, OutPoint, ScanError,
    ScanOutcome, ScanSecret, ScanSkipReason, ScanStopReason, TaprootOutput, K_MAX,
};
use ripemd::{Digest as RipemdDigest, Ripemd160};
use secp256k1::{Parity, PublicKey, Scalar, Secp256k1, SecretKey};
use serde_json::Value;
use sha2::{Digest as Sha2Digest, Sha256};

const OFFICIAL_VECTORS: &str = include_str!("data/send_and_receive_test_vectors.json");

const INPUTS_TAG: &[u8] = b"BIP0352/Inputs";
const SHARED_SECRET_TAG: &[u8] = b"BIP0352/SharedSecret";
const LABEL_TAG: &[u8] = b"BIP0352/Label";

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
    let sha256 = <Sha256 as Sha2Digest>::digest(bytes);
    <Ripemd160 as RipemdDigest>::digest(sha256).into()
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

fn scan_secret(given: &Value) -> ScanSecret {
    ScanSecret::from_bytes(fixed::<32>(string_field(
        &given["key_material"],
        "scan_priv_key",
    )))
    .expect("official scan secret must be valid")
}

fn spend_public_key(given: &Value) -> [u8; 33] {
    let spend_secret = SecretKey::from_byte_array(fixed::<32>(string_field(
        &given["key_material"],
        "spend_priv_key",
    )))
    .expect("official spend secret must be valid");
    PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret).serialize()
}

fn spend_public_key_point(given: &Value) -> PublicKey {
    let spend_public_key = spend_public_key(given);
    PublicKey::from_byte_array_compressed(spend_public_key).expect("official spend public key")
}

fn labels(given: &Value) -> Vec<u32> {
    given["labels"]
        .as_array()
        .expect("official labels must be an array")
        .iter()
        .map(|label| label.as_u64().expect("official label must be an integer") as u32)
        .collect()
}

fn independent_tagged_hash(tag: &[u8], message: &[u8]) -> [u8; 32] {
    let tag_hash = Sha256::digest(tag);
    let mut hasher = Sha256::new();
    hasher.update(tag_hash);
    hasher.update(tag_hash);
    hasher.update(message);
    hasher.finalize().into()
}

fn independent_scalar(bytes: [u8; 32]) -> Scalar {
    let scalar = Scalar::from_be_bytes(bytes).expect("official vector scalar must be in range");
    assert_ne!(
        scalar,
        Scalar::ZERO,
        "official vector scalar must be non-zero"
    );
    scalar
}

fn public_key_from_input(input: &EligibleInput) -> PublicKey {
    match input.public_key {
        EligibleInputPublicKey::Compressed(bytes) => {
            PublicKey::from_byte_array_compressed(bytes).expect("official input key")
        }
        EligibleInputPublicKey::XOnly(bytes) => {
            let x_only = secp256k1::XOnlyPublicKey::from_byte_array(bytes)
                .expect("official taproot input key");
            PublicKey::from_x_only_public_key(x_only, Parity::Even)
        }
    }
}

fn independent_input_public_key_sum(inputs: &[EligibleInput]) -> Option<PublicKey> {
    let keys: Vec<PublicKey> = inputs.iter().map(public_key_from_input).collect();
    let key_refs: Vec<&PublicKey> = keys.iter().collect();
    PublicKey::combine_keys(&key_refs).ok()
}

fn independent_label_scalar(scan_secret: &[u8; 32], index: u32) -> Scalar {
    let mut message = [0u8; 36];
    message[..32].copy_from_slice(scan_secret);
    message[32..].copy_from_slice(&index.to_be_bytes());
    independent_scalar(independent_tagged_hash(LABEL_TAG, &message))
}

fn independent_shared_secret_tweak(shared_secret: &[u8; 33], k: u32) -> Scalar {
    let mut message = [0u8; 37];
    message[..33].copy_from_slice(shared_secret);
    message[33..].copy_from_slice(&k.to_be_bytes());
    independent_scalar(independent_tagged_hash(SHARED_SECRET_TAG, &message))
}

fn add_scalars(left: Scalar, right: Scalar) -> Scalar {
    let left_bytes = left.to_be_bytes();
    let mut result = SecretKey::from_byte_array(left_bytes)
        .expect("official scalar must be usable as a secret key")
        .add_tweak(&right)
        .expect("official scalar addition must remain non-zero");
    let result_bytes = result.secret_bytes();
    result.non_secure_erase();
    independent_scalar(result_bytes)
}

fn assert_expected_intermediates(
    given: &Value,
    expected: &Value,
    inputs: &[EligibleInput],
    all_input_outpoints: &[OutPoint],
) {
    // These canonical vector fields are intentionally not exposed by ScanReport. Recompute them
    // here with independent test-only primitives so the production scanner is not tested by
    // merely echoing its own intermediate values.
    let Some(expected_sum_hex) = expected.get("input_pub_key_sum").and_then(Value::as_str) else {
        assert!(
            expected.get("tweak").and_then(Value::as_str).is_none()
                && expected
                    .get("shared_secret")
                    .and_then(Value::as_str)
                    .is_none(),
            "official intermediate fields must be present together"
        );
        return;
    };

    let input_public_key_sum =
        independent_input_public_key_sum(inputs).expect("official input sum must be finite");
    assert_eq!(
        input_public_key_sum.serialize(),
        fixed::<33>(expected_sum_hex),
        "canonical input public-key sum"
    );

    let lowest_outpoint = all_input_outpoints
        .iter()
        .copied()
        .min()
        .expect("official eligible transaction must have inputs");
    let mut input_hash_message = Vec::with_capacity(69);
    input_hash_message.extend_from_slice(&lowest_outpoint.serialize());
    input_hash_message.extend_from_slice(&input_public_key_sum.serialize());
    let input_hash = independent_scalar(independent_tagged_hash(INPUTS_TAG, &input_hash_message));
    let secp = Secp256k1::new();
    let tweak_point = input_public_key_sum
        .mul_tweak(&secp, &input_hash)
        .expect("official input tweak point");

    let scan_secret = fixed::<32>(string_field(&given["key_material"], "scan_priv_key"));
    let scan_secret_key = SecretKey::from_byte_array(scan_secret).expect("official scan secret");
    let shared_secret = tweak_point
        .mul_tweak(&secp, &Scalar::from(scan_secret_key))
        .expect("official shared secret point");

    assert_eq!(
        tweak_point.serialize(),
        fixed::<33>(string_field(expected, "tweak")),
        "canonical input tweak point"
    );
    assert_eq!(
        shared_secret.serialize(),
        fixed::<33>(string_field(expected, "shared_secret")),
        "canonical shared-secret point"
    );
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ExpectedMatch {
    output_key: [u8; 32],
    k: u32,
    kind: MatchKind,
    matched_negated_output_key: bool,
}

fn expected_match(given: &Value, expected: &Value, output: &Value) -> ExpectedMatch {
    let expected_private_tweak = fixed::<32>(string_field(output, "priv_key_tweak"));
    let expected_output_key = fixed::<32>(string_field(output, "pub_key"));
    let shared_secret = fixed::<33>(string_field(expected, "shared_secret"));
    let scan_secret = fixed::<32>(string_field(&given["key_material"], "scan_priv_key"));
    let receiver_labels = labels(given);
    let spend_public_key = spend_public_key_point(given);
    let secp = Secp256k1::new();
    let mut candidates = Vec::new();

    for k in 0..K_MAX {
        let shared_tweak = independent_shared_secret_tweak(&shared_secret, k);
        if shared_tweak.to_be_bytes() == expected_private_tweak {
            candidates.push((k, MatchKind::Unlabeled, shared_tweak));
        }
        for label in &receiver_labels {
            let label_tweak = independent_label_scalar(&scan_secret, *label);
            let candidate_tweak = add_scalars(shared_tweak, label_tweak);
            if candidate_tweak.to_be_bytes() == expected_private_tweak {
                candidates.push((k, MatchKind::Label { index: *label }, candidate_tweak));
            }
        }
    }

    assert_eq!(
        candidates.len(),
        1,
        "each official output private tweak must identify exactly one k/label"
    );
    let (k, kind, candidate_tweak) = candidates.pop().expect("one official candidate");
    let derived_point = spend_public_key
        .add_exp_tweak(&secp, &candidate_tweak)
        .expect("official output tweak point");
    assert_eq!(
        derived_point.x_only_public_key().0.serialize(),
        expected_output_key,
        "canonical output public key for k/label"
    );
    let matched_negated_output_key = matches!(kind, MatchKind::Label { .. })
        && derived_point.x_only_public_key().1 == Parity::Odd;

    ExpectedMatch {
        output_key: expected_output_key,
        k,
        kind,
        matched_negated_output_key,
    }
}

fn expected_matches(given: &Value, expected: &Value) -> Vec<ExpectedMatch> {
    expected["outputs"]
        .as_array()
        .expect("official expected outputs must be an array")
        .iter()
        .map(|output| expected_match(given, expected, output))
        .collect()
}

fn canonical_k_max_matches(given: &Value, expected: &Value) -> Vec<ExpectedMatch> {
    let shared_secret = fixed::<33>(string_field(expected, "shared_secret"));
    let scan_secret = fixed::<32>(string_field(&given["key_material"], "scan_priv_key"));
    let receiver_labels = labels(given);
    let spend_public_key = spend_public_key_point(given);
    let secp = Secp256k1::new();
    let output_keys: Vec<[u8; 32]> = given["outputs"]
        .as_array()
        .expect("official K_max outputs array")
        .iter()
        .map(|output| fixed::<32>(output.as_str().expect("official output key")))
        .collect();

    (0..K_MAX)
        .map(|k| {
            let shared_tweak = independent_shared_secret_tweak(&shared_secret, k);
            let mut candidates = vec![(MatchKind::Unlabeled, shared_tweak)];
            for label in &receiver_labels {
                candidates.push((
                    MatchKind::Label { index: *label },
                    add_scalars(shared_tweak, independent_label_scalar(&scan_secret, *label)),
                ));
            }

            let expected_output_key = output_keys[k as usize];
            let matching_candidates: Vec<(MatchKind, Scalar)> = candidates
                .into_iter()
                .filter(|(_, tweak)| {
                    spend_public_key
                        .add_exp_tweak(&secp, tweak)
                        .expect("official K_max output tweak point")
                        .x_only_public_key()
                        .0
                        .serialize()
                        == expected_output_key
                })
                .collect();
            assert_eq!(
                matching_candidates.len(),
                1,
                "each K_max output identity must have one canonical k/label"
            );
            let (kind, candidate_tweak) = matching_candidates
                .into_iter()
                .next()
                .expect("one canonical K_max output candidate");
            let derived_point = spend_public_key
                .add_exp_tweak(&secp, &candidate_tweak)
                .expect("official K_max output point");
            ExpectedMatch {
                output_key: expected_output_key,
                k,
                kind,
                matched_negated_output_key: matches!(kind, MatchKind::Label { .. })
                    && derived_point.x_only_public_key().1 == Parity::Odd,
            }
        })
        .collect()
}

fn expected_output_indices(outputs: &[TaprootOutput], expected_keys: &[[u8; 32]]) -> Vec<usize> {
    let mut used = vec![false; outputs.len()];
    expected_keys
        .iter()
        .map(|expected_key| {
            let output_index = outputs
                .iter()
                .enumerate()
                .find(|(index, output)| !used[*index] && output.output_key == *expected_key)
                .map(|(index, _)| index)
                .expect("official expected output must exist in transaction outputs");
            used[output_index] = true;
            output_index
        })
        .collect()
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
            let all_input_outpoints = all_input_outpoints(given);
            let receiver_labels = labels(given);
            assert_expected_intermediates(given, expected, &inputs, &all_input_outpoints);
            let canonical_expected = if case_index == 27 {
                canonical_k_max_matches(given, expected)
            } else {
                expected_matches(given, expected)
            };
            let expected_count = expected
                .get("n_outputs")
                .and_then(Value::as_u64)
                .map(|count| count as usize)
                .unwrap_or(canonical_expected.len());
            assert_eq!(
                canonical_expected.len(),
                expected_count,
                "official case {case_index} ({comment}) canonical expected count"
            );
            let outcome = scan_transaction(
                &scan_secret(given),
                spend_public_key(given),
                &all_input_outpoints,
                &inputs,
                &outputs,
                &receiver_labels,
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
                    assert!(report
                        .matches
                        .windows(2)
                        .all(|window| window[0].k < window[1].k));

                    let expected_keys: Vec<[u8; 32]> = canonical_expected
                        .iter()
                        .map(|matched| matched.output_key)
                        .collect();
                    let expected_indices = expected_output_indices(&outputs, &expected_keys);
                    let mut actual_matches = report.matches.clone();
                    actual_matches.sort_by_key(|matched| matched.output_index);
                    assert_eq!(
                        actual_matches
                            .iter()
                            .map(|matched| matched.output_index)
                            .collect::<Vec<_>>(),
                        expected_indices,
                        "official case {case_index} ({comment}) output order and duplicate identities"
                    );
                    assert_eq!(
                        actual_matches
                            .iter()
                            .map(|matched| matched.output_key)
                            .collect::<Vec<_>>(),
                        expected_keys,
                        "official case {case_index} ({comment}) output keys in transaction order"
                    );

                    let mut seen_output_indexes = HashSet::new();
                    for (matched, expected_match) in
                        actual_matches.iter().zip(canonical_expected.iter())
                    {
                        assert!(seen_output_indexes.insert(matched.output_index));
                        let output = &outputs[matched.output_index];
                        assert_eq!(matched.outpoint, output.outpoint);
                        assert_eq!(matched.value_sat, output.value_sat);
                        assert_eq!(matched.is_unspent, output.is_unspent);
                        assert_eq!(matched.output_key, expected_match.output_key);
                        assert_eq!(matched.k, expected_match.k);
                        assert_eq!(matched.kind, expected_match.kind);
                        assert_eq!(
                            matched.matched_negated_output_key,
                            expected_match.matched_negated_output_key
                        );
                    }
                    if case_index == 27 {
                        assert_eq!(report.matches.len(), K_MAX as usize);
                        assert_eq!(report.stop_reason, ScanStopReason::ReachedKMax);
                        assert_eq!(report.matches.last().unwrap().k, K_MAX - 1);
                        assert_eq!(
                            report
                                .matches
                                .iter()
                                .map(|matched| matched.output_index)
                                .collect::<Vec<_>>(),
                            (0..K_MAX as usize).collect::<Vec<_>>()
                        );
                    } else {
                        assert_eq!(report.stop_reason, ScanStopReason::NoMatch);
                    }
                }
            }
        }
    }

    assert_eq!(tested_receivers, 29);
}

#[test]
fn ordered_output_adapter_preserves_duplicate_identities() {
    let output_key = [0x42u8; 32];
    let outputs = vec![
        TaprootOutput {
            output_key,
            outpoint: OutPoint {
                txid_le: [1u8; 32],
                vout: 0,
            },
            value_sat: 1,
            is_unspent: true,
        },
        TaprootOutput {
            output_key,
            outpoint: OutPoint {
                txid_le: [2u8; 32],
                vout: 1,
            },
            value_sat: 2,
            is_unspent: true,
        },
    ];

    assert_eq!(
        expected_output_indices(&outputs, &[output_key, output_key]),
        vec![0, 1]
    );
}

#[test]
fn malformed_public_records_fail_closed_without_secret_bearing_errors() {
    let scan_secret = ScanSecret::from_bytes([1u8; 32]).expect("test scan secret");
    let spend_secret = SecretKey::from_byte_array([2u8; 32]).expect("test spend secret");
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
