use std::time::Instant;

use conxius_silent_payments::{
    estimate_scan_work_units, scan_transaction_with_cancellation, CancellationToken, ScanError,
    ScanOutcome, ScanSecret, ScanSkipReason, MAX_ECC_WORK_UNITS_PER_BATCH,
};
use zeroize::Zeroizing;

use crate::{
    codec::{decode_public_batch, BatchMetrics, PublicBatch, PublicMatch, PublicScanResult},
    derive::derive_receiver_keys,
    error::NativeErrorCode,
};

/// Scan one bounded public batch. Secret derivation and all secret-bearing temporaries remain in
/// this function's native scope; only `PublicScanResult` leaves the call.
pub fn scan_public_batch(
    mnemonic: &[u8],
    passphrase: &[u8],
    encoded_batch: &[u8],
) -> Result<PublicScanResult, NativeErrorCode> {
    scan_public_batch_with_cancellation(mnemonic, passphrase, encoded_batch, &())
}

/// Scan one bounded public batch with cooperative cancellation checked between transactions and
/// inside the core's bounded BIP-352 output-index loop.
pub fn scan_public_batch_with_cancellation<C: CancellationToken>(
    mnemonic: &[u8],
    passphrase: &[u8],
    encoded_batch: &[u8],
    cancellation: &C,
) -> Result<PublicScanResult, NativeErrorCode> {
    let batch = decode_public_batch(encoded_batch)?;
    scan_decoded_batch(
        mnemonic,
        passphrase,
        encoded_batch.len(),
        &batch,
        cancellation,
    )
}

fn scan_decoded_batch<C: CancellationToken>(
    mnemonic: &[u8],
    passphrase: &[u8],
    batch_bytes: usize,
    batch: &PublicBatch,
    cancellation: &C,
) -> Result<PublicScanResult, NativeErrorCode> {
    let started = Instant::now();
    if cancellation.is_cancelled() {
        return Err(NativeErrorCode::Cancelled);
    }
    let estimated_batch_work = batch
        .transactions
        .iter()
        .try_fold(0u64, |total, transaction| {
            let transaction_work = estimate_scan_work_units(
                transaction.eligible_inputs.len(),
                transaction.outputs.len(),
                batch.labels.len(),
            )
            .map_err(map_scan_error)?;
            total
                .checked_add(transaction_work)
                .ok_or(NativeErrorCode::ResourceLimit)
        })?;
    if estimated_batch_work > MAX_ECC_WORK_UNITS_PER_BATCH {
        return Err(NativeErrorCode::ResourceLimit);
    }
    let derived = derive_receiver_keys(mnemonic, passphrase, batch.network, batch.account)?;
    let scan_secret =
        ScanSecret::from_bytes(*derived.scan_secret).map_err(|_| NativeErrorCode::InvalidSecret)?;

    let mut matches = Vec::new();
    let mut scanned_transaction_count = 0u32;
    let mut skipped_transaction_count = 0u32;

    for transaction in &batch.transactions {
        if cancellation.is_cancelled() {
            return Err(NativeErrorCode::Cancelled);
        }
        let outcome = scan_transaction_with_cancellation(
            &scan_secret,
            derived.spend_public_key,
            &transaction.all_input_outpoints,
            &transaction.eligible_inputs,
            &transaction.outputs,
            &batch.labels,
            cancellation,
        )
        .map_err(map_scan_error)?;

        match outcome {
            ScanOutcome::Scanned(report) => {
                scanned_transaction_count = scanned_transaction_count
                    .checked_add(1)
                    .ok_or(NativeErrorCode::ResourceLimit)?;
                for scan_match in report.matches {
                    if matches.len() >= crate::codec::MAX_MATCHES {
                        return Err(NativeErrorCode::ResourceLimit);
                    }
                    matches.push(PublicMatch {
                        transaction_id: transaction.transaction_id,
                        block_height: transaction.block_height,
                        transaction_index: transaction.transaction_index,
                        scan_match,
                    });
                }
            }
            ScanOutcome::Skipped(ScanSkipReason::NoEligibleInputs)
            | ScanOutcome::Skipped(ScanSkipReason::InputPublicKeySumAtInfinity) => {
                skipped_transaction_count = skipped_transaction_count
                    .checked_add(1)
                    .ok_or(NativeErrorCode::ResourceLimit)?;
            }
        }
    }

    let transaction_count =
        u32::try_from(batch.transactions.len()).map_err(|_| NativeErrorCode::ResourceLimit)?;
    let match_count = u32::try_from(matches.len()).map_err(|_| NativeErrorCode::ResourceLimit)?;
    let batch_bytes = u32::try_from(batch_bytes).map_err(|_| NativeErrorCode::ResourceLimit)?;

    Ok(PublicScanResult {
        metrics: BatchMetrics {
            transaction_count,
            scanned_transaction_count,
            skipped_transaction_count,
            match_count,
            elapsed_micros: started.elapsed().as_micros().min(u128::from(u64::MAX)) as u64,
            batch_bytes,
        },
        matches,
    })
}

fn map_scan_error(error: ScanError) -> NativeErrorCode {
    match error {
        ScanError::ResourceLimitExceeded { .. } => NativeErrorCode::ResourceLimit,
        ScanError::InvalidScanSecret => NativeErrorCode::InvalidSecret,
        ScanError::InvalidSpendPublicKey
        | ScanError::InvalidInputPublicKey(_)
        | ScanError::InvalidOutputKey(_)
        | ScanError::DuplicateTransactionOutpoint(_)
        | ScanError::MissingEligibleInputOutpoint(_)
        | ScanError::DuplicateEligibleInputOutpoint(_)
        | ScanError::DuplicateOutputOutpoint(_)
        | ScanError::DuplicateOutputVout(_)
        | ScanError::MissingTransactionOutpoints => NativeErrorCode::InvalidPublicRecord,
        ScanError::Cancelled => NativeErrorCode::Cancelled,
        ScanError::InvalidInputHash
        | ScanError::InvalidSharedSecretTweak(_)
        | ScanError::InvalidLabel(_)
        | ScanError::PointOperation => NativeErrorCode::EccFailure,
        ScanError::ComputationBudgetExceeded { .. } | ScanError::ComputationBudgetOverflow => {
            NativeErrorCode::ResourceLimit
        }
    }
}

#[allow(dead_code)]
fn _secret_type_is_zeroizing(_: &Zeroizing<[u8; 32]>) {}
