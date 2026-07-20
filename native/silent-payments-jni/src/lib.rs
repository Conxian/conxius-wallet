//! JNI adapter and bounded binary protocol for the BIP-352 receiver scanner.
//!
//! The platform-neutral scan implementation remains in `conxius-silent-payments`. This crate
//! owns only secret derivation, public batch/result codecs, stable error mapping, and the thin
//! JNI export used by Kotlin. The JNI function is the only FFI-facing unsafe boundary; it catches
//! panics and never exposes secret-bearing diagnostics.

mod codec;
mod derive;
mod error;
mod scan;

pub use codec::{
    decode_public_batch, decode_scan_result, encode_public_batch, encode_scan_result, BatchMetrics,
    DecodedResult, PublicBatch, PublicMatch, PublicScanResult, PublicTransaction, MAX_BATCH_BYTES,
    MAX_BATCH_OUTPUTS, MAX_BATCH_TRANSACTIONS, MAX_MATCHES, MAX_RESULT_BYTES,
};
pub use derive::{derive_receiver_keys, DerivedReceiverKeys, Network};
pub use error::NativeErrorCode;
pub use scan::scan_public_batch;

mod jni_bridge {
    use std::{
        panic::{catch_unwind, AssertUnwindSafe},
        ptr,
    };

    use jni::{
        objects::{JByteArray, JClass},
        sys::jbyteArray,
        JNIEnv,
    };

    use crate::{error::NativeErrorCode, scan_public_batch};

    const MAX_SECRET_BYTES: i32 = 512;
    const MAX_BATCH_BYTES: i32 = crate::codec::MAX_BATCH_BYTES as i32;

    /// JNI export for `NativeSilentPayments.nativeScan`.
    ///
    /// The mnemonic and passphrase arrays are secret arguments and are never combined with the
    /// public batch array. The method returns the versioned result envelope, including a stable
    /// non-secret error code on failure. `catch_unwind` prevents Rust panics from crossing JNI.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeScan(
        env: JNIEnv,
        _class: JClass,
        mnemonic: JByteArray,
        passphrase: JByteArray,
        public_batch: JByteArray,
    ) -> jbyteArray {
        let response = catch_unwind(AssertUnwindSafe(|| {
            let mnemonic_length = env.get_array_length(&mnemonic).ok();
            let passphrase_length = env.get_array_length(&passphrase).ok();
            let batch_length = env.get_array_length(&public_batch).ok();

            if mnemonic_length.is_none() || passphrase_length.is_none() || batch_length.is_none() {
                return crate::error::encode_error_result(NativeErrorCode::Internal);
            }

            let mnemonic_length = mnemonic_length.unwrap_or_default();
            let passphrase_length = passphrase_length.unwrap_or_default();
            let batch_length = batch_length.unwrap_or_default();

            if mnemonic_length < 0 || passphrase_length < 0 || batch_length < 0 {
                return crate::error::encode_error_result(NativeErrorCode::Internal);
            }
            if mnemonic_length > MAX_SECRET_BYTES || passphrase_length > MAX_SECRET_BYTES {
                return crate::error::encode_error_result(NativeErrorCode::InvalidSecret);
            }
            if batch_length > MAX_BATCH_BYTES {
                return crate::error::encode_error_result(NativeErrorCode::ResourceLimit);
            }

            let mnemonic = match env.convert_byte_array(mnemonic) {
                Ok(bytes) => zeroize::Zeroizing::new(bytes),
                Err(_) => {
                    return crate::error::encode_error_result(NativeErrorCode::Internal);
                }
            };
            let passphrase = match env.convert_byte_array(passphrase) {
                Ok(bytes) => zeroize::Zeroizing::new(bytes),
                Err(_) => {
                    return crate::error::encode_error_result(NativeErrorCode::Internal);
                }
            };
            let public_batch = match env.convert_byte_array(public_batch) {
                Ok(bytes) => bytes,
                Err(_) => {
                    return crate::error::encode_error_result(NativeErrorCode::Internal);
                }
            };

            scan_public_batch(&mnemonic, &passphrase, &public_batch)
                .map(|result| crate::codec::encode_scan_result(&result))
                .unwrap_or_else(crate::error::encode_error_result)
        }))
        .unwrap_or_else(|_| crate::error::encode_error_result(NativeErrorCode::Internal));

        match env.byte_array_from_slice(&response) {
            Ok(array) => array.into_raw(),
            Err(_) => ptr::null_mut(),
        }
    }
}
