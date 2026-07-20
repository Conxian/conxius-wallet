use std::collections::HashSet;

use conxius_silent_payments::{
    EligibleInput, EligibleInputPublicKey, MatchKind, OutPoint, ScanMatch, TaprootOutput,
    MAX_ELIGIBLE_INPUTS, MAX_LABELS, MAX_TAPROOT_OUTPUTS,
};

use crate::{error::NativeErrorCode, Network};

// The placeholder import above is replaced below by the actual core constant. Keeping all
// protocol limits in one module makes the codec audit surface explicit.

pub const BATCH_MAGIC: [u8; 4] = *b"SPB1";
pub const RESULT_MAGIC: [u8; 4] = *b"SPR1";
pub const CODEC_VERSION: u8 = 1;

pub const MAX_BATCH_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_RESULT_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_BATCH_TRANSACTIONS: usize = 1024;
pub const MAX_BATCH_OUTPUTS: usize = 65_536;
pub const MAX_MATCHES: usize = 65_536;
pub const MAX_MNEMONIC_BYTES: usize = 512;
pub const MAX_PASSPHRASE_BYTES: usize = 512;

/// A public, structured transaction batch. No private key material is represented here.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicBatch {
    pub network: Network,
    pub account: u32,
    pub start_block: u64,
    pub end_block: u64,
    pub labels: Vec<u32>,
    pub transactions: Vec<PublicTransaction>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicTransaction {
    pub block_height: u64,
    pub transaction_index: u32,
    pub all_input_outpoints: Vec<OutPoint>,
    pub eligible_inputs: Vec<EligibleInput>,
    pub outputs: Vec<TaprootOutput>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchMetrics {
    pub transaction_count: u32,
    pub scanned_transaction_count: u32,
    pub skipped_transaction_count: u32,
    pub match_count: u32,
    pub elapsed_micros: u64,
    pub batch_bytes: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicMatch {
    pub block_height: u64,
    pub transaction_index: u32,
    pub scan_match: ScanMatch,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicScanResult {
    pub metrics: BatchMetrics,
    pub matches: Vec<PublicMatch>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DecodedResult {
    Success(PublicScanResult),
    Error(NativeErrorCode),
}

/// Decode the public transaction protocol after validating all count and byte bounds.
pub fn decode_public_batch(bytes: &[u8]) -> Result<PublicBatch, NativeErrorCode> {
    if bytes.len() > MAX_BATCH_BYTES {
        return Err(NativeErrorCode::ResourceLimit);
    }
    let mut reader = Reader::new(bytes);
    if reader
        .read_exact(4)
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        != BATCH_MAGIC
    {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    if reader
        .read_u8()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        != CODEC_VERSION
    {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }

    let network = Network::from_code(
        reader
            .read_u8()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
    )
    .ok_or(NativeErrorCode::InvalidNetwork)?;
    let account = reader
        .read_u32()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    if account != 0 {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    let start_block = reader
        .read_u64()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    let end_block = reader
        .read_u64()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    if start_block > end_block {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }

    let transaction_count = bounded_count(
        reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
        MAX_BATCH_TRANSACTIONS,
    )?;
    let label_count = bounded_count(
        reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
        MAX_LABELS,
    )?;

    let mut labels = Vec::with_capacity(label_count);
    let mut seen_labels = HashSet::with_capacity(label_count);
    for _ in 0..label_count {
        let label = reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        if !seen_labels.insert(label) {
            return Err(NativeErrorCode::InvalidPublicBatch);
        }
        labels.push(label);
    }

    let mut transactions = Vec::with_capacity(transaction_count);
    let mut total_outputs = 0usize;
    for _ in 0..transaction_count {
        let block_height = reader
            .read_u64()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        if block_height < start_block || block_height > end_block {
            return Err(NativeErrorCode::InvalidPublicBatch);
        }
        let transaction_index = reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        let input_count = bounded_count(
            reader
                .read_u32()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
            MAX_TRANSACTION_INPUTS,
        )?;
        let eligible_count = bounded_count(
            reader
                .read_u32()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
            MAX_ELIGIBLE_INPUTS,
        )?;
        let output_count = bounded_count(
            reader
                .read_u32()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
            MAX_TAPROOT_OUTPUTS,
        )?;
        total_outputs = total_outputs
            .checked_add(output_count)
            .ok_or(NativeErrorCode::ResourceLimit)?;
        if total_outputs > MAX_BATCH_OUTPUTS {
            return Err(NativeErrorCode::ResourceLimit);
        }

        // Counts are bounded before any per-record vector allocation.
        let mut all_input_outpoints = Vec::with_capacity(input_count);
        for _ in 0..input_count {
            all_input_outpoints.push(read_outpoint(&mut reader)?);
        }

        let mut eligible_inputs = Vec::with_capacity(eligible_count);
        let mut seen_input_indexes = HashSet::with_capacity(eligible_count);
        for _ in 0..eligible_count {
            let input_index = reader
                .read_u32()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
                as usize;
            if input_index >= input_count || !seen_input_indexes.insert(input_index) {
                return Err(NativeErrorCode::InvalidPublicBatch);
            }
            let key_kind = reader
                .read_u8()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
            let public_key = match key_kind {
                0 => {
                    let bytes = read_fixed::<33>(&mut reader)?;
                    if !matches!(bytes[0], 0x02 | 0x03) {
                        return Err(NativeErrorCode::InvalidPublicRecord);
                    }
                    EligibleInputPublicKey::Compressed(bytes)
                }
                1 => EligibleInputPublicKey::XOnly(read_fixed::<32>(&mut reader)?),
                _ => return Err(NativeErrorCode::InvalidPublicBatch),
            };
            eligible_inputs.push(EligibleInput {
                outpoint: all_input_outpoints[input_index],
                public_key,
            });
        }

        let mut outputs = Vec::with_capacity(output_count);
        for _ in 0..output_count {
            let output_key = read_fixed::<32>(&mut reader)?;
            let outpoint = read_outpoint(&mut reader)?;
            let value_sat = reader
                .read_u64()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
            let is_unspent = match reader
                .read_u8()
                .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
            {
                0 => false,
                1 => true,
                _ => return Err(NativeErrorCode::InvalidPublicBatch),
            };
            outputs.push(TaprootOutput {
                output_key,
                outpoint,
                value_sat,
                is_unspent,
            });
        }

        transactions.push(PublicTransaction {
            block_height,
            transaction_index,
            all_input_outpoints,
            eligible_inputs,
            outputs,
        });
    }

    if !reader.is_empty() {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }

    Ok(PublicBatch {
        network,
        account,
        start_block,
        end_block,
        labels,
        transactions,
    })
}

/// Encode the public transaction protocol. Validation happens before writing any bytes.
pub fn encode_public_batch(batch: &PublicBatch) -> Result<Vec<u8>, NativeErrorCode> {
    validate_batch(batch)?;
    let encoded_size = encoded_batch_size(batch)?;
    let mut writer = Writer::with_capacity(encoded_size);
    writer.bytes(&BATCH_MAGIC);
    writer.u8(CODEC_VERSION);
    writer.u8(batch.network.code());
    writer.u32(batch.account);
    writer.u64(batch.start_block);
    writer.u64(batch.end_block);
    writer.u32(batch.transactions.len() as u32);
    writer.u32(batch.labels.len() as u32);
    for label in &batch.labels {
        writer.u32(*label);
    }

    for transaction in &batch.transactions {
        writer.u64(transaction.block_height);
        writer.u32(transaction.transaction_index);
        writer.u32(transaction.all_input_outpoints.len() as u32);
        writer.u32(transaction.eligible_inputs.len() as u32);
        writer.u32(transaction.outputs.len() as u32);
        for outpoint in &transaction.all_input_outpoints {
            write_outpoint(&mut writer, *outpoint);
        }
        for eligible in &transaction.eligible_inputs {
            let input_index = transaction
                .all_input_outpoints
                .iter()
                .position(|outpoint| *outpoint == eligible.outpoint)
                .ok_or(NativeErrorCode::InvalidPublicRecord)?;
            writer.u32(input_index as u32);
            match eligible.public_key {
                EligibleInputPublicKey::Compressed(bytes) => {
                    writer.u8(0);
                    writer.bytes(&bytes);
                }
                EligibleInputPublicKey::XOnly(bytes) => {
                    writer.u8(1);
                    writer.bytes(&bytes);
                }
            }
        }
        for output in &transaction.outputs {
            writer.bytes(&output.output_key);
            write_outpoint(&mut writer, output.outpoint);
            writer.u64(output.value_sat);
            writer.u8(u8::from(output.is_unspent));
        }
    }

    debug_assert_eq!(writer.bytes.len(), encoded_size);
    Ok(writer.bytes)
}

/// Decode a versioned result envelope for host tests and the Kotlin parity fixture.
pub fn decode_scan_result(bytes: &[u8]) -> Result<DecodedResult, NativeErrorCode> {
    if bytes.len() > MAX_RESULT_BYTES {
        return Err(NativeErrorCode::ResourceLimit);
    }
    let mut reader = Reader::new(bytes);
    if reader
        .read_exact(4)
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        != RESULT_MAGIC
    {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    if reader
        .read_u8()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        != CODEC_VERSION
    {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    let status = reader
        .read_u8()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    if status != 0 {
        let code = NativeErrorCode::from_byte(status).ok_or(NativeErrorCode::InvalidPublicBatch)?;
        if !reader.is_empty() {
            return Err(NativeErrorCode::InvalidPublicBatch);
        }
        return Ok(DecodedResult::Error(code));
    }

    let transaction_count = reader
        .read_u32()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    let scanned_transaction_count = reader
        .read_u32()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    let skipped_transaction_count = reader
        .read_u32()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    let match_count = bounded_count(
        reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
        MAX_MATCHES,
    )?;
    let elapsed_micros = reader
        .read_u64()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    let batch_bytes = reader
        .read_u32()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    let encoded_match_count = bounded_count(
        reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
        MAX_MATCHES,
    )?;
    if encoded_match_count != match_count {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }

    let mut matches = Vec::with_capacity(encoded_match_count);
    for _ in 0..encoded_match_count {
        let block_height = reader
            .read_u64()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        let transaction_index = reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        let output_index = reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)? as usize;
        let output_key = read_fixed::<32>(&mut reader)?;
        let outpoint = read_outpoint(&mut reader)?;
        let value_sat = reader
            .read_u64()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        let is_unspent = match reader
            .read_u8()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        {
            0 => false,
            1 => true,
            _ => return Err(NativeErrorCode::InvalidPublicBatch),
        };
        let k = reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
        let kind = match reader
            .read_u8()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        {
            0 => MatchKind::Unlabeled,
            1 => MatchKind::Label {
                index: reader
                    .read_u32()
                    .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
            },
            _ => return Err(NativeErrorCode::InvalidPublicBatch),
        };
        let matched_negated_output_key = match reader
            .read_u8()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?
        {
            0 => false,
            1 => true,
            _ => return Err(NativeErrorCode::InvalidPublicBatch),
        };
        matches.push(PublicMatch {
            block_height,
            transaction_index,
            scan_match: ScanMatch {
                output_index,
                output_key,
                outpoint,
                value_sat,
                is_unspent,
                k,
                kind,
                matched_negated_output_key,
            },
        });
    }
    if !reader.is_empty() {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    if u64::from(scanned_transaction_count) + u64::from(skipped_transaction_count)
        > u64::from(transaction_count)
    {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    Ok(DecodedResult::Success(PublicScanResult {
        metrics: BatchMetrics {
            transaction_count,
            scanned_transaction_count,
            skipped_transaction_count,
            match_count: match_count as u32,
            elapsed_micros,
            batch_bytes,
        },
        matches,
    }))
}

pub fn encode_scan_result(result: &PublicScanResult) -> Vec<u8> {
    if result.matches.len() > MAX_MATCHES
        || result.metrics.match_count as usize != result.matches.len()
    {
        return crate::error::encode_error_result(NativeErrorCode::ResourceLimit);
    }
    if result
        .matches
        .iter()
        .any(|matched| matched.scan_match.output_index > u32::MAX as usize)
    {
        return crate::error::encode_error_result(NativeErrorCode::InvalidPublicRecord);
    }
    let encoded_size = match encoded_result_size(result) {
        Ok(size) if size <= MAX_RESULT_BYTES => size,
        Ok(_) | Err(NativeErrorCode::ResourceLimit) => {
            return crate::error::encode_error_result(NativeErrorCode::ResourceLimit);
        }
        Err(code) => return crate::error::encode_error_result(code),
    };

    let mut writer = Writer::with_capacity(encoded_size);
    writer.bytes(&RESULT_MAGIC);
    writer.u8(CODEC_VERSION);
    writer.u8(0);
    writer.u32(result.metrics.transaction_count);
    writer.u32(result.metrics.scanned_transaction_count);
    writer.u32(result.metrics.skipped_transaction_count);
    writer.u32(result.metrics.match_count);
    writer.u64(result.metrics.elapsed_micros);
    writer.u32(result.metrics.batch_bytes);
    writer.u32(result.matches.len() as u32);
    for matched in &result.matches {
        writer.u64(matched.block_height);
        writer.u32(matched.transaction_index);
        writer.u32(matched.scan_match.output_index as u32);
        writer.bytes(&matched.scan_match.output_key);
        write_outpoint(&mut writer, matched.scan_match.outpoint);
        writer.u64(matched.scan_match.value_sat);
        writer.u8(u8::from(matched.scan_match.is_unspent));
        writer.u32(matched.scan_match.k);
        match matched.scan_match.kind {
            MatchKind::Unlabeled => writer.u8(0),
            MatchKind::Label { index } => {
                writer.u8(1);
                writer.u32(index);
            }
        }
        writer.u8(u8::from(matched.scan_match.matched_negated_output_key));
    }
    debug_assert_eq!(writer.bytes.len(), encoded_size);
    writer.bytes
}

fn encoded_batch_size(batch: &PublicBatch) -> Result<usize, NativeErrorCode> {
    let mut size = 34usize;
    size = checked_size_add(
        size,
        batch
            .labels
            .len()
            .checked_mul(4)
            .ok_or(NativeErrorCode::ResourceLimit)?,
    )?;
    for transaction in &batch.transactions {
        size = checked_size_add(size, 24)?;
        size = checked_size_add(
            size,
            transaction
                .all_input_outpoints
                .len()
                .checked_mul(36)
                .ok_or(NativeErrorCode::ResourceLimit)?,
        )?;
        for eligible in &transaction.eligible_inputs {
            let key_bytes = match eligible.public_key {
                EligibleInputPublicKey::Compressed(_) => 33,
                EligibleInputPublicKey::XOnly(_) => 32,
            };
            size = checked_size_add(size, 5 + key_bytes)?;
        }
        size = checked_size_add(
            size,
            transaction
                .outputs
                .len()
                .checked_mul(77)
                .ok_or(NativeErrorCode::ResourceLimit)?,
        )?;
    }
    if size > MAX_BATCH_BYTES {
        return Err(NativeErrorCode::ResourceLimit);
    }
    Ok(size)
}

fn encoded_result_size(result: &PublicScanResult) -> Result<usize, NativeErrorCode> {
    let mut size = 38usize;
    for matched in &result.matches {
        let label_bytes = match matched.scan_match.kind {
            MatchKind::Unlabeled => 0,
            MatchKind::Label { .. } => 4,
        };
        size = checked_size_add(size, 99 + label_bytes)?;
    }
    Ok(size)
}

fn checked_size_add(left: usize, right: usize) -> Result<usize, NativeErrorCode> {
    left.checked_add(right)
        .ok_or(NativeErrorCode::ResourceLimit)
}

fn validate_batch(batch: &PublicBatch) -> Result<(), NativeErrorCode> {
    if batch.account != 0 || batch.start_block > batch.end_block {
        return Err(NativeErrorCode::InvalidPublicBatch);
    }
    if batch.transactions.len() > MAX_BATCH_TRANSACTIONS {
        return Err(NativeErrorCode::ResourceLimit);
    }
    if batch.labels.len() > MAX_LABELS {
        return Err(NativeErrorCode::ResourceLimit);
    }
    let mut labels = HashSet::with_capacity(batch.labels.len());
    for label in &batch.labels {
        if !labels.insert(*label) {
            return Err(NativeErrorCode::InvalidPublicBatch);
        }
    }

    let mut total_outputs = 0usize;
    for transaction in &batch.transactions {
        if transaction.block_height < batch.start_block
            || transaction.block_height > batch.end_block
        {
            return Err(NativeErrorCode::InvalidPublicBatch);
        }
        if transaction.all_input_outpoints.len() > MAX_TRANSACTION_INPUTS
            || transaction.eligible_inputs.len() > MAX_ELIGIBLE_INPUTS
            || transaction.outputs.len() > MAX_TAPROOT_OUTPUTS
        {
            return Err(NativeErrorCode::ResourceLimit);
        }
        total_outputs = total_outputs
            .checked_add(transaction.outputs.len())
            .ok_or(NativeErrorCode::ResourceLimit)?;
        if total_outputs > MAX_BATCH_OUTPUTS {
            return Err(NativeErrorCode::ResourceLimit);
        }

        let all_outpoints: HashSet<OutPoint> =
            transaction.all_input_outpoints.iter().copied().collect();
        if all_outpoints.len() != transaction.all_input_outpoints.len() {
            return Err(NativeErrorCode::InvalidPublicRecord);
        }
        let mut eligible_outpoints = HashSet::with_capacity(transaction.eligible_inputs.len());
        for eligible in &transaction.eligible_inputs {
            if !all_outpoints.contains(&eligible.outpoint)
                || !eligible_outpoints.insert(eligible.outpoint)
            {
                return Err(NativeErrorCode::InvalidPublicRecord);
            }
            if let EligibleInputPublicKey::Compressed(bytes) = eligible.public_key {
                if !matches!(bytes[0], 0x02 | 0x03) {
                    return Err(NativeErrorCode::InvalidPublicRecord);
                }
            }
        }
    }
    Ok(())
}

fn bounded_count(value: u32, limit: usize) -> Result<usize, NativeErrorCode> {
    let count = value as usize;
    if count > limit {
        return Err(NativeErrorCode::ResourceLimit);
    }
    Ok(count)
}

fn read_outpoint(reader: &mut Reader<'_>) -> Result<OutPoint, NativeErrorCode> {
    Ok(OutPoint {
        txid_le: read_fixed::<32>(reader)?,
        vout: reader
            .read_u32()
            .map_err(|_| NativeErrorCode::InvalidPublicBatch)?,
    })
}

fn write_outpoint(writer: &mut Writer, outpoint: OutPoint) {
    writer.bytes(&outpoint.txid_le);
    writer.u32(outpoint.vout);
}

fn read_fixed<const N: usize>(reader: &mut Reader<'_>) -> Result<[u8; N], NativeErrorCode> {
    let bytes = reader
        .read_exact(N)
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)?;
    bytes
        .try_into()
        .map_err(|_| NativeErrorCode::InvalidPublicBatch)
}

struct Reader<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, position: 0 }
    }

    fn is_empty(&self) -> bool {
        self.position == self.bytes.len()
    }

    fn read_exact(&mut self, length: usize) -> Result<&'a [u8], ()> {
        let end = self.position.checked_add(length).ok_or(())?;
        if end > self.bytes.len() {
            return Err(());
        }
        let value = &self.bytes[self.position..end];
        self.position = end;
        Ok(value)
    }

    fn read_u8(&mut self) -> Result<u8, ()> {
        Ok(self.read_exact(1)?[0])
    }

    fn read_u32(&mut self) -> Result<u32, ()> {
        Ok(u32::from_le_bytes(
            self.read_exact(4)?.try_into().map_err(|_| ())?,
        ))
    }

    fn read_u64(&mut self) -> Result<u64, ()> {
        Ok(u64::from_le_bytes(
            self.read_exact(8)?.try_into().map_err(|_| ())?,
        ))
    }
}

struct Writer {
    bytes: Vec<u8>,
}

impl Writer {
    fn with_capacity(capacity: usize) -> Self {
        Self {
            bytes: Vec::with_capacity(capacity),
        }
    }

    fn bytes(&mut self, bytes: &[u8]) {
        self.bytes.extend_from_slice(bytes);
    }

    fn u8(&mut self, value: u8) {
        self.bytes.push(value);
    }

    fn u32(&mut self, value: u32) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn u64(&mut self, value: u64) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }
}

// Keep this alias local so the codec's limits remain readable even if the core module renames its
// public constant in a future revision.
const MAX_TRANSACTION_INPUTS: usize = conxius_silent_payments::MAX_TRANSACTION_INPUTS;
