//! Deterministic BIP-352 receiver scanning primitives.
//!
//! This crate accepts structured transaction scan records and validates their bounded public
//! invariants. It does not fetch transactions, parse private keys from JSON, perform JNI calls,
//! or perform I/O. The scan secret is passed separately from public transaction records so a
//! future JNI batch API can keep secret handling explicit.

use std::{
    collections::{HashMap, HashSet},
    fmt,
    sync::atomic::{AtomicBool, Ordering},
};

use secp256k1::{
    constants::PUBLIC_KEY_SIZE, Parity, PublicKey, Scalar, Secp256k1, SecretKey, XOnlyPublicKey,
};
use sha2::{Digest, Sha256};
use thiserror::Error;
use zeroize::Zeroizing;

/// BIP-352's maximum number of sequential output indices checked for one receiver group.
pub const K_MAX: u32 = 2323;

/// Maximum number of transaction input outpoints accepted by one scan call.
pub const MAX_TRANSACTION_INPUTS: usize = 4096;

/// Maximum number of eligible input public keys accepted by one scan call.
pub const MAX_ELIGIBLE_INPUTS: usize = 4096;

/// Maximum number of taproot outputs inspected by one scan call.
pub const MAX_TAPROOT_OUTPUTS: usize = 4096;

/// Maximum number of receiver labels expanded into label public keys by one scan call.
pub const MAX_LABELS: usize = 256;

/// Cooperative cancellation seam used by the JNI call. The core checks it between transactions
/// in the batch adapter and before/inside the bounded BIP-352 `k` loop. It is deliberately
/// cooperative: cancellation cannot interrupt a single secp256k1 primitive in progress.
pub trait CancellationToken {
    fn is_cancelled(&self) -> bool;
}

impl CancellationToken for () {
    fn is_cancelled(&self) -> bool {
        false
    }
}

impl CancellationToken for AtomicBool {
    fn is_cancelled(&self) -> bool {
        self.load(Ordering::Relaxed)
    }
}

const INPUTS_TAG: &[u8] = b"BIP0352/Inputs";
const SHARED_SECRET_TAG: &[u8] = b"BIP0352/SharedSecret";
const LABEL_TAG: &[u8] = b"BIP0352/Label";

/// An outpoint in the byte order used by Bitcoin transaction serialization.
///
/// `txid_le` is the transaction id in little-endian byte order. This is intentionally explicit:
/// BIP-352 sorts and hashes the serialized `COutPoint`, not the human-facing big-endian txid
/// string and not the integer value of `vout`.
#[derive(Clone, Copy, Eq, PartialEq, Hash)]
pub struct OutPoint {
    pub txid_le: [u8; 32],
    pub vout: u32,
}

impl OutPoint {
    /// Serializes this outpoint as `txid_le || vout_le`.
    pub fn serialize(self) -> [u8; 36] {
        let mut serialized = [0u8; 36];
        serialized[..32].copy_from_slice(&self.txid_le);
        serialized[32..].copy_from_slice(&self.vout.to_le_bytes());
        serialized
    }
}

impl Ord for OutPoint {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.serialize().cmp(&other.serialize())
    }
}

impl PartialOrd for OutPoint {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl fmt::Debug for OutPoint {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("OutPoint")
            .field("txid_le", &"[redacted from diagnostic output]")
            .field("vout", &self.vout)
            .finish()
    }
}

/// An eligible input public key supplied by the transaction parser.
///
/// Taproot input keys are supplied as x-only keys and are interpreted as the even-Y point, as
/// required by BIP-352. Other eligible input types use their compressed SEC1 representation.
#[derive(Clone, Copy, Eq, PartialEq)]
pub enum EligibleInputPublicKey {
    Compressed([u8; PUBLIC_KEY_SIZE]),
    XOnly([u8; 32]),
}

impl fmt::Debug for EligibleInputPublicKey {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("EligibleInputPublicKey(REDACTED)")
    }
}

/// A validated, eligible input record for one transaction scan.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EligibleInput {
    pub outpoint: OutPoint,
    pub public_key: EligibleInputPublicKey,
}

/// A taproot output record supplied by the transaction parser.
///
/// The output key is x-only. The remaining fields are opaque mapping metadata retained in a
/// match so a caller can associate a discovered payment with a UTXO without giving this crate
/// responsibility for chain access.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TaprootOutput {
    pub output_key: [u8; 32],
    pub outpoint: OutPoint,
    pub value_sat: u64,
    pub is_unspent: bool,
}

/// Receiver scan secret. The bytes are validated as a non-zero secp256k1 scalar and zeroized on
/// drop. It intentionally has no accessor or secret-bearing `Debug` implementation. Temporary
/// secp256k1 scalar/key copies are erased on the normal path where the dependency exposes its
/// safe best-effort erasure API; this does not claim immunity from compiler-generated copies.
pub struct ScanSecret(Zeroizing<[u8; 32]>);

impl ScanSecret {
    /// Creates a scan secret from raw big-endian bytes.
    pub fn from_bytes(bytes: [u8; 32]) -> Result<Self, ScanError> {
        let mut secret_key =
            SecretKey::from_byte_array(&bytes).map_err(|_| ScanError::InvalidScanSecret)?;
        secret_key.non_secure_erase();
        Ok(Self(Zeroizing::new(bytes)))
    }

    fn scalar(&self) -> Scalar {
        // The constructor already checked this value as a non-zero secret key.
        Scalar::from_be_bytes(*self.as_bytes()).expect("validated scan secret must be a scalar")
    }

    fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl fmt::Debug for ScanSecret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ScanSecret(REDACTED)")
    }
}

/// Why a transaction was skipped without being malformed.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ScanSkipReason {
    NoEligibleInputs,
    InputPublicKeySumAtInfinity,
}

/// How the deterministic output-index loop stopped.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ScanStopReason {
    NoMatch,
    ReachedKMax,
}

/// Caller-controlled collection whose size is bounded before allocation or ECC work.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ScanResource {
    TransactionInputs,
    EligibleInputs,
    TaprootOutputs,
    Labels,
}

impl fmt::Display for ScanResource {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
            Self::TransactionInputs => "transaction input",
            Self::EligibleInputs => "eligible input",
            Self::TaprootOutputs => "taproot output",
            Self::Labels => "label",
        };
        formatter.write_str(name)
    }
}

/// Whether a match was unlabeled or matched one of the receiver's labels.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MatchKind {
    Unlabeled,
    Label { index: u32 },
}

/// A discovered taproot output and the public metadata needed for UTXO mapping.
///
/// The private scan key, ECDH shared secret, and private output tweak are intentionally not
/// returned. A later spending path can deterministically recompute the private tweak from the
/// receiver keys and the returned `k`/label metadata inside a secure native boundary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ScanMatch {
    pub output_index: usize,
    pub output_key: [u8; 32],
    pub outpoint: OutPoint,
    pub value_sat: u64,
    pub is_unspent: bool,
    pub k: u32,
    pub kind: MatchKind,
    pub matched_negated_output_key: bool,
}

/// Results for a transaction that had a finite eligible input key sum.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScanReport {
    pub matches: Vec<ScanMatch>,
    pub stop_reason: ScanStopReason,
}

/// A scan either produces a report or skips a transaction under BIP-352's fail-closed rules.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScanOutcome {
    Scanned(ScanReport),
    Skipped(ScanSkipReason),
}

/// Errors for malformed public inputs or invalid BIP-352 scalar material.
///
/// Variants contain only structural indexes and static context. No secret bytes, transaction
/// records, points, or shared secrets are included in error output.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
pub enum ScanError {
    #[error("{resource} count {actual} exceeds limit {limit}")]
    ResourceLimitExceeded {
        resource: ScanResource,
        actual: usize,
        limit: usize,
    },
    #[error("scan secret is not a valid non-zero secp256k1 scalar")]
    InvalidScanSecret,
    #[error("spend public key is malformed")]
    InvalidSpendPublicKey,
    #[error("eligible input public key at index {0} is malformed")]
    InvalidInputPublicKey(usize),
    #[error("taproot output key at index {0} is malformed")]
    InvalidOutputKey(usize),
    #[error("duplicate transaction input outpoint at index {0}")]
    DuplicateTransactionOutpoint(usize),
    #[error("eligible input at index {0} references a missing transaction outpoint")]
    MissingEligibleInputOutpoint(usize),
    #[error("duplicate eligible input outpoint at index {0}")]
    DuplicateEligibleInputOutpoint(usize),
    #[error("duplicate output outpoint at index {0}")]
    DuplicateOutputOutpoint(usize),
    #[error("duplicate output vout at index {0}")]
    DuplicateOutputVout(usize),
    #[error("transaction outpoints are required when eligible inputs are present")]
    MissingTransactionOutpoints,
    #[error("scan was cancelled")]
    Cancelled,
    #[error("BIP-352 input hash is not a valid non-zero scalar")]
    InvalidInputHash,
    #[error("BIP-352 shared-secret tweak at k={0} is not a valid non-zero scalar")]
    InvalidSharedSecretTweak(u32),
    #[error("BIP-352 label {0} is not a valid non-zero scalar")]
    InvalidLabel(u32),
    #[error("secp256k1 point operation failed")]
    PointOperation,
}

/// Scan one already-parsed transaction for one receiver group.
///
/// The public transaction records and the scan secret are deliberately separate arguments. The
/// function is deterministic and side-effect-free: it performs no network access, filesystem
/// I/O, logging, JNI calls, or JSON parsing. `all_input_outpoints` must contain every transaction
/// input outpoint, while `inputs` contains only the eligible input public keys. BIP-352 hashes
/// the lexicographically smallest serialized outpoint used by the transaction, including inputs
/// whose public key is not eligible for the public-key sum.
pub fn scan_transaction(
    scan_secret: &ScanSecret,
    spend_public_key: [u8; PUBLIC_KEY_SIZE],
    all_input_outpoints: &[OutPoint],
    inputs: &[EligibleInput],
    outputs: &[TaprootOutput],
    labels: &[u32],
) -> Result<ScanOutcome, ScanError> {
    scan_transaction_with_cancellation(
        scan_secret,
        spend_public_key,
        all_input_outpoints,
        inputs,
        outputs,
        labels,
        &(),
    )
}

/// Scan one transaction with a cooperative cancellation token.
pub fn scan_transaction_with_cancellation<C: CancellationToken>(
    scan_secret: &ScanSecret,
    spend_public_key: [u8; PUBLIC_KEY_SIZE],
    all_input_outpoints: &[OutPoint],
    inputs: &[EligibleInput],
    outputs: &[TaprootOutput],
    labels: &[u32],
    cancellation: &C,
) -> Result<ScanOutcome, ScanError> {
    validate_scan_records(all_input_outpoints, inputs, outputs, labels)?;
    if cancellation.is_cancelled() {
        return Err(ScanError::Cancelled);
    }

    let secp = Secp256k1::new();
    let spend_public_key = PublicKey::from_byte_array_compressed(&spend_public_key)
        .map_err(|_| ScanError::InvalidSpendPublicKey)?;

    if inputs.is_empty() {
        return Ok(ScanOutcome::Skipped(ScanSkipReason::NoEligibleInputs));
    }
    if all_input_outpoints.is_empty() {
        return Err(ScanError::MissingTransactionOutpoints);
    }

    let mut parsed_inputs = Vec::with_capacity(inputs.len());
    for (index, input) in inputs.iter().enumerate() {
        if cancellation.is_cancelled() {
            return Err(ScanError::Cancelled);
        }
        let public_key = match input.public_key {
            EligibleInputPublicKey::Compressed(bytes) => {
                PublicKey::from_byte_array_compressed(&bytes)
            }
            EligibleInputPublicKey::XOnly(bytes) => XOnlyPublicKey::from_byte_array(&bytes)
                .map(|x_only| PublicKey::from_x_only_public_key(x_only, Parity::Even)),
        }
        .map_err(|_| ScanError::InvalidInputPublicKey(index))?;
        parsed_inputs.push((input, public_key));
    }

    let public_key_refs: Vec<&PublicKey> = parsed_inputs.iter().map(|(_, key)| key).collect();
    let input_public_key_sum = match PublicKey::combine_keys(&public_key_refs) {
        Ok(sum) => sum,
        Err(_) => {
            return Ok(ScanOutcome::Skipped(
                ScanSkipReason::InputPublicKeySumAtInfinity,
            ));
        }
    };

    let mut parsed_outputs = Vec::with_capacity(outputs.len());
    for (index, output) in outputs.iter().enumerate() {
        if cancellation.is_cancelled() {
            return Err(ScanError::Cancelled);
        }
        let x_only = XOnlyPublicKey::from_byte_array(&output.output_key)
            .map_err(|_| ScanError::InvalidOutputKey(index))?;
        parsed_outputs.push((
            *output,
            PublicKey::from_x_only_public_key(x_only, Parity::Even),
        ));
    }

    let lowest_outpoint = all_input_outpoints
        .iter()
        .copied()
        .min()
        .expect("non-empty transaction outpoint list");
    let mut input_hash_message = Vec::with_capacity(69);
    input_hash_message.extend_from_slice(&lowest_outpoint.serialize());
    input_hash_message.extend_from_slice(&input_public_key_sum.serialize());
    let mut input_hash = valid_nonzero_scalar(&tagged_hash(INPUTS_TAG, &input_hash_message))
        .ok_or(ScanError::InvalidInputHash)?;

    // `Scalar` and `SecretKey` expose safe best-effort erasure methods. They do not promise
    // that the compiler never copied a value, so this is cleanup rather than a hard guarantee.
    let ecdh_serialized = {
        let mut scan_scalar = scan_secret.scalar();
        let first_ecdh = input_public_key_sum.mul_tweak(&secp, &input_hash);
        input_hash.non_secure_erase();
        let first_ecdh = first_ecdh.map_err(|_| ScanError::PointOperation)?;
        let ecdh_point = first_ecdh.mul_tweak(&secp, &scan_scalar);
        scan_scalar.non_secure_erase();
        let ecdh_point = ecdh_point.map_err(|_| ScanError::PointOperation)?;
        Zeroizing::new(ecdh_point.serialize())
    };

    if cancellation.is_cancelled() {
        return Err(ScanError::Cancelled);
    }
    let label_candidates = build_label_candidates(scan_secret, labels, &secp)?;
    let mut matched_outputs = vec![false; parsed_outputs.len()];
    let mut matched_output_count = 0usize;
    let mut matches = Vec::with_capacity(parsed_outputs.len().min(K_MAX as usize));
    let mut stop_reason = ScanStopReason::NoMatch;

    for k in 0..K_MAX {
        if cancellation.is_cancelled() {
            return Err(ScanError::Cancelled);
        }
        let mut tweak_message = Zeroizing::new([0u8; 37]);
        tweak_message[..33].copy_from_slice(ecdh_serialized.as_ref());
        tweak_message[33..].copy_from_slice(&k.to_be_bytes());
        let mut tweak =
            valid_nonzero_scalar(&tagged_hash(SHARED_SECRET_TAG, tweak_message.as_ref()))
                .ok_or(ScanError::InvalidSharedSecretTweak(k))?;
        let derived_key = spend_public_key.add_exp_tweak(&secp, &tweak);
        tweak.non_secure_erase();
        let derived_key = derived_key.map_err(|_| ScanError::PointOperation)?;
        let derived_x_only = derived_key.x_only_public_key().0.serialize();

        let mut found_match = None;
        for (output_index, (output, output_point)) in parsed_outputs.iter().enumerate() {
            if cancellation.is_cancelled() {
                return Err(ScanError::Cancelled);
            }
            if matched_outputs[output_index] {
                continue;
            }

            if derived_x_only == output.output_key {
                found_match = Some((output_index, MatchKind::Unlabeled, false));
                break;
            }

            if label_candidates.is_empty() {
                continue;
            }

            let derived_negative = derived_key.negate(&secp);
            if let Some(kind) = find_label_match(*output_point, derived_negative, &label_candidates)
            {
                found_match = Some((output_index, kind, false));
                break;
            }

            let negated_output = output_point.negate(&secp);
            if let Some(kind) =
                find_label_match(negated_output, derived_negative, &label_candidates)
            {
                found_match = Some((output_index, kind, true));
                break;
            }
        }

        let Some((output_index, kind, matched_negated_output_key)) = found_match else {
            stop_reason = ScanStopReason::NoMatch;
            break;
        };

        matched_outputs[output_index] = true;
        matched_output_count += 1;
        let (output, _) = parsed_outputs
            .get(output_index)
            .ok_or(ScanError::PointOperation)?;
        matches.push(ScanMatch {
            output_index,
            output_key: output.output_key,
            outpoint: output.outpoint,
            value_sat: output.value_sat,
            is_unspent: output.is_unspent,
            k,
            kind,
            matched_negated_output_key,
        });

        if matched_output_count == parsed_outputs.len() {
            stop_reason = ScanStopReason::NoMatch;
            break;
        }
    }

    if matched_output_count < parsed_outputs.len() && matches.len() == K_MAX as usize {
        stop_reason = ScanStopReason::ReachedKMax;
    }

    Ok(ScanOutcome::Scanned(ScanReport {
        matches,
        stop_reason,
    }))
}

fn validate_scan_records(
    all_input_outpoints: &[OutPoint],
    inputs: &[EligibleInput],
    outputs: &[TaprootOutput],
    labels: &[u32],
) -> Result<(), ScanError> {
    validate_limit(
        ScanResource::TransactionInputs,
        all_input_outpoints.len(),
        MAX_TRANSACTION_INPUTS,
    )?;
    validate_limit(
        ScanResource::EligibleInputs,
        inputs.len(),
        MAX_ELIGIBLE_INPUTS,
    )?;
    validate_limit(
        ScanResource::TaprootOutputs,
        outputs.len(),
        MAX_TAPROOT_OUTPUTS,
    )?;
    validate_limit(ScanResource::Labels, labels.len(), MAX_LABELS)?;

    if !inputs.is_empty() && all_input_outpoints.is_empty() {
        return Err(ScanError::MissingTransactionOutpoints);
    }

    let mut all_outpoints = HashSet::with_capacity(all_input_outpoints.len());
    for (index, outpoint) in all_input_outpoints.iter().enumerate() {
        if !all_outpoints.insert(*outpoint) {
            return Err(ScanError::DuplicateTransactionOutpoint(index));
        }
    }

    let mut eligible_outpoints = HashSet::with_capacity(inputs.len());
    for (index, input) in inputs.iter().enumerate() {
        if !eligible_outpoints.insert(input.outpoint) {
            return Err(ScanError::DuplicateEligibleInputOutpoint(index));
        }
        if !all_outpoints.contains(&input.outpoint) {
            return Err(ScanError::MissingEligibleInputOutpoint(index));
        }
    }

    let mut output_outpoints = HashSet::with_capacity(outputs.len());
    let mut output_vouts = HashSet::with_capacity(outputs.len());
    for (index, output) in outputs.iter().enumerate() {
        if !output_outpoints.insert(output.outpoint) {
            return Err(ScanError::DuplicateOutputOutpoint(index));
        }
        if !output_vouts.insert(output.outpoint.vout) {
            return Err(ScanError::DuplicateOutputVout(index));
        }
    }

    Ok(())
}

fn validate_limit(resource: ScanResource, actual: usize, limit: usize) -> Result<(), ScanError> {
    if actual > limit {
        return Err(ScanError::ResourceLimitExceeded {
            resource,
            actual,
            limit,
        });
    }
    Ok(())
}

fn build_label_candidates(
    scan_secret: &ScanSecret,
    labels: &[u32],
    secp: &Secp256k1<secp256k1::All>,
) -> Result<HashMap<[u8; PUBLIC_KEY_SIZE], u32>, ScanError> {
    let mut candidates = HashMap::with_capacity(labels.len());
    for &index in labels {
        let mut message = Zeroizing::new([0u8; 36]);
        message[..32].copy_from_slice(scan_secret.as_bytes());
        message[32..].copy_from_slice(&index.to_be_bytes());
        let mut scalar = valid_nonzero_scalar(&tagged_hash(LABEL_TAG, message.as_ref()))
            .ok_or(ScanError::InvalidLabel(index))?;
        let scalar_bytes = Zeroizing::new(scalar.to_be_bytes());
        let mut secret_key = match SecretKey::from_byte_array(&scalar_bytes) {
            Ok(secret_key) => secret_key,
            Err(_) => {
                scalar.non_secure_erase();
                return Err(ScanError::InvalidLabel(index));
            }
        };
        let point = PublicKey::from_secret_key(secp, &secret_key);
        secret_key.non_secure_erase();
        scalar.non_secure_erase();
        candidates.entry(point.serialize()).or_insert(index);
    }
    Ok(candidates)
}

fn find_label_match(
    output_point: PublicKey,
    derived_negative: PublicKey,
    candidates: &HashMap<[u8; PUBLIC_KEY_SIZE], u32>,
) -> Option<MatchKind> {
    let label_point = output_point.combine(&derived_negative).ok()?;
    candidates
        .get(&label_point.serialize())
        .copied()
        .map(|index| MatchKind::Label { index })
}

fn valid_nonzero_scalar(bytes: &[u8; 32]) -> Option<Scalar> {
    let scalar = Scalar::from_be_bytes(*bytes).ok()?;
    (scalar != Scalar::ZERO).then_some(scalar)
}

fn tagged_hash(tag: &[u8], message: &[u8]) -> Zeroizing<[u8; 32]> {
    let tag_hash = Sha256::digest(tag);
    let mut hasher = Sha256::new();
    hasher.update(tag_hash);
    hasher.update(tag_hash);
    hasher.update(message);
    Zeroizing::new(hasher.finalize().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    fn test_spend_public_key() -> [u8; PUBLIC_KEY_SIZE] {
        let spend_secret = SecretKey::from_byte_array(&[2u8; 32]).expect("test spend secret");
        PublicKey::from_secret_key(&Secp256k1::new(), &spend_secret).serialize()
    }

    fn test_outpoint(vout: u32) -> OutPoint {
        OutPoint {
            txid_le: [vout as u8; 32],
            vout,
        }
    }

    fn test_input(outpoint: OutPoint) -> EligibleInput {
        EligibleInput {
            outpoint,
            public_key: EligibleInputPublicKey::Compressed(test_spend_public_key()),
        }
    }

    struct CancelAt {
        checks: AtomicUsize,
        cancel_at: usize,
    }

    impl CancellationToken for CancelAt {
        fn is_cancelled(&self) -> bool {
            self.checks.fetch_add(1, Ordering::Relaxed) >= self.cancel_at
        }
    }

    #[test]
    fn tagged_hash_uses_bip340_double_tag_prefix() {
        let actual = tagged_hash(b"BIP0352/Inputs", b"test message");
        let expected = [
            0x39, 0x36, 0x00, 0xe2, 0x90, 0x47, 0xfc, 0x23, 0x3f, 0xa1, 0x09, 0x4d, 0x81, 0x97,
            0x0c, 0x9a, 0x51, 0xcc, 0xf0, 0xd4, 0x14, 0xa2, 0x39, 0x3c, 0x01, 0xa6, 0x1f, 0x68,
            0xb3, 0x0a, 0x49, 0x64,
        ];
        assert_eq!(actual.as_ref(), &expected);
    }

    #[test]
    fn outpoints_sort_by_serialized_bytes() {
        let txid = [0u8; 32];
        let vout_one = OutPoint {
            txid_le: txid,
            vout: 1,
        };
        let vout_256 = OutPoint {
            txid_le: txid,
            vout: 256,
        };
        assert!(vout_256 < vout_one);
    }

    #[test]
    fn scan_secret_debug_is_redacted() {
        let secret = ScanSecret::from_bytes([1u8; 32]).expect("test scalar");
        let debug = format!("{secret:?}");
        assert_eq!(debug, "ScanSecret(REDACTED)");
        assert!(!debug.contains("010101"));
    }

    #[test]
    fn zero_and_out_of_range_scalars_are_rejected() {
        assert!(valid_nonzero_scalar(&[0u8; 32]).is_none());
        assert!(valid_nonzero_scalar(&[
            0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
            0xff, 0xfe, 0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c,
            0xd0, 0x36, 0x41, 0x41,
        ])
        .is_none());
    }

    #[test]
    fn resource_limits_are_enforced_before_ecc_parsing() {
        let scan_secret = ScanSecret::from_bytes([1u8; 32]).expect("test scan secret");
        let spend_public_key = test_spend_public_key();
        let invalid_input = EligibleInput {
            outpoint: test_outpoint(0),
            public_key: EligibleInputPublicKey::Compressed([0u8; PUBLIC_KEY_SIZE]),
        };

        let too_many_transaction_inputs = vec![test_outpoint(0); MAX_TRANSACTION_INPUTS + 1];
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &too_many_transaction_inputs,
                &[],
                &[],
                &[],
            ),
            Err(ScanError::ResourceLimitExceeded {
                resource: ScanResource::TransactionInputs,
                actual: MAX_TRANSACTION_INPUTS + 1,
                limit: MAX_TRANSACTION_INPUTS,
            })
        );

        let too_many_eligible_inputs = vec![invalid_input; MAX_ELIGIBLE_INPUTS + 1];
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[],
                &too_many_eligible_inputs,
                &[],
                &[],
            ),
            Err(ScanError::ResourceLimitExceeded {
                resource: ScanResource::EligibleInputs,
                actual: MAX_ELIGIBLE_INPUTS + 1,
                limit: MAX_ELIGIBLE_INPUTS,
            })
        );

        let too_many_outputs = vec![
            TaprootOutput {
                output_key: [0u8; 32],
                outpoint: test_outpoint(0),
                value_sat: 0,
                is_unspent: false,
            };
            MAX_TAPROOT_OUTPUTS + 1
        ];
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[],
                &[],
                &too_many_outputs,
                &[],
            ),
            Err(ScanError::ResourceLimitExceeded {
                resource: ScanResource::TaprootOutputs,
                actual: MAX_TAPROOT_OUTPUTS + 1,
                limit: MAX_TAPROOT_OUTPUTS,
            })
        );

        let too_many_labels = vec![0u32; MAX_LABELS + 1];
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[],
                &[],
                &[],
                &too_many_labels,
            ),
            Err(ScanError::ResourceLimitExceeded {
                resource: ScanResource::Labels,
                actual: MAX_LABELS + 1,
                limit: MAX_LABELS,
            })
        );
    }

    #[test]
    fn transaction_record_outpoint_invariants_are_enforced() {
        let scan_secret = ScanSecret::from_bytes([1u8; 32]).expect("test scan secret");
        let spend_public_key = test_spend_public_key();
        let input = test_input(test_outpoint(1));

        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[test_outpoint(0)],
                &[input],
                &[],
                &[],
            ),
            Err(ScanError::MissingEligibleInputOutpoint(0))
        );

        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[test_outpoint(0), test_outpoint(0)],
                &[],
                &[],
                &[],
            ),
            Err(ScanError::DuplicateTransactionOutpoint(1))
        );

        let duplicate_eligible = test_input(test_outpoint(0));
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[test_outpoint(0)],
                &[duplicate_eligible, duplicate_eligible],
                &[],
                &[],
            ),
            Err(ScanError::DuplicateEligibleInputOutpoint(1))
        );

        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[],
                &[test_input(test_outpoint(0))],
                &[],
                &[],
            ),
            Err(ScanError::MissingTransactionOutpoints)
        );

        let output_key = PublicKey::from_secret_key(
            &Secp256k1::new(),
            &SecretKey::from_byte_array(&[3u8; 32]).expect("test output secret"),
        )
        .x_only_public_key()
        .0
        .serialize();
        let duplicate_output = TaprootOutput {
            output_key,
            outpoint: test_outpoint(2),
            value_sat: 1,
            is_unspent: true,
        };
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[],
                &[],
                &[duplicate_output, duplicate_output],
                &[],
            ),
            Err(ScanError::DuplicateOutputOutpoint(1))
        );

        let duplicate_vout = [
            duplicate_output,
            TaprootOutput {
                outpoint: OutPoint {
                    txid_le: [9u8; 32],
                    vout: 2,
                },
                ..duplicate_output
            },
        ];
        assert_eq!(
            scan_transaction(
                &scan_secret,
                spend_public_key,
                &[],
                &[],
                &duplicate_vout,
                &[],
            ),
            Err(ScanError::DuplicateOutputVout(1))
        );
    }

    #[test]
    fn cancellation_is_checked_inside_the_bounded_k_loop() {
        let scan_secret = ScanSecret::from_bytes([1u8; 32]).expect("test scan secret");
        let spend_public_key = test_spend_public_key();
        let input_outpoint = test_outpoint(0);
        let output_key = PublicKey::from_secret_key(
            &Secp256k1::new(),
            &SecretKey::from_byte_array(&[3u8; 32]).expect("test output secret"),
        )
        .x_only_public_key()
        .0
        .serialize();
        let cancellation = CancelAt {
            checks: AtomicUsize::new(0),
            cancel_at: 5,
        };

        assert_eq!(
            scan_transaction_with_cancellation(
                &scan_secret,
                spend_public_key,
                &[input_outpoint],
                &[test_input(input_outpoint)],
                &[TaprootOutput {
                    output_key,
                    outpoint: test_outpoint(1),
                    value_sat: 1,
                    is_unspent: true,
                }],
                &[],
                &cancellation,
            ),
            Err(ScanError::Cancelled)
        );
        assert!(cancellation.checks.load(Ordering::Relaxed) >= 5);
    }
}
