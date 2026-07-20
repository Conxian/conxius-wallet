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
    MAX_BATCH_OUTPUTS, MAX_BATCH_TRANSACTIONS, MAX_K, MAX_MATCHES, MAX_RESULT_BYTES,
};
pub use derive::{derive_receiver_keys, DerivedReceiverKeys, Network};
pub use error::NativeErrorCode;
pub use scan::{scan_public_batch, scan_public_batch_with_cancellation};

pub const MAX_ECC_WORK_UNITS_PER_BATCH: u64 = conxius_silent_payments::MAX_ECC_WORK_UNITS_PER_BATCH;

mod jni_bridge {
    use std::{
        collections::HashMap,
        panic::{catch_unwind, AssertUnwindSafe},
        ptr,
        sync::{
            atomic::{AtomicBool, AtomicU64, Ordering},
            Arc, Mutex, OnceLock,
        },
    };

    use jni::{
        objects::{JByteArray, JClass},
        sys::{jbyteArray, jlong},
        JNIEnv,
    };

    use crate::{error::NativeErrorCode, scan::scan_public_batch_with_cancellation};

    const MAX_SECRET_BYTES: i32 = crate::codec::MAX_MNEMONIC_BYTES as i32;
    const MAX_BATCH_BYTES: i32 = crate::codec::MAX_BATCH_BYTES as i32;

    static NEXT_CANCELLATION_HANDLE: AtomicU64 = AtomicU64::new(1);
    static CANCELLATION_HANDLES: OnceLock<Mutex<HashMap<u64, Arc<AtomicBool>>>> = OnceLock::new();

    fn cancellation_handles() -> &'static Mutex<HashMap<u64, Arc<AtomicBool>>> {
        CANCELLATION_HANDLES.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn create_cancellation_handle() -> jlong {
        let handle = NEXT_CANCELLATION_HANDLE.fetch_add(1, Ordering::Relaxed);
        let token = Arc::new(AtomicBool::new(false));
        match cancellation_handles().lock() {
            Ok(mut handles) => {
                handles.insert(handle, token);
                handle as jlong
            }
            Err(_) => 0,
        }
    }

    fn get_cancellation_handle(handle: jlong) -> Option<Arc<AtomicBool>> {
        if handle <= 0 {
            return None;
        }
        cancellation_handles()
            .lock()
            .ok()
            .and_then(|handles| handles.get(&(handle as u64)).cloned())
    }

    fn cancel_cancellation_handle(handle: jlong) {
        if let Some(token) = get_cancellation_handle(handle) {
            token.store(true, Ordering::Relaxed);
        }
    }

    fn destroy_cancellation_handle(handle: jlong) {
        if handle > 0 {
            if let Ok(mut handles) = cancellation_handles().lock() {
                handles.remove(&(handle as u64));
            }
        }
    }

    fn clear_pending_exception(env: &mut JNIEnv<'_>) {
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_clear();
        }
    }

    fn stable_error(env: &mut JNIEnv<'_>, code: NativeErrorCode) -> Vec<u8> {
        clear_pending_exception(env);
        crate::error::encode_error_result(code)
    }

    /// Create a cooperative cancellation token for one blocking native scan.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeCreateCancellationHandle(
        _env: JNIEnv,
        _class: JClass,
    ) -> jlong {
        catch_unwind(create_cancellation_handle).unwrap_or(0)
    }

    /// Mark one native scan token cancelled. The core checks the flag between records and in its
    /// bounded BIP-352 output-index loop; it cannot interrupt an individual secp256k1 primitive.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeCancel(
        _env: JNIEnv,
        _class: JClass,
        handle: jlong,
    ) {
        let _ = catch_unwind(|| cancel_cancellation_handle(handle));
    }

    /// Release one native scan token after the Kotlin coroutine has completed.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeDestroyCancellationHandle(
        _env: JNIEnv,
        _class: JClass,
        handle: jlong,
    ) {
        let _ = catch_unwind(|| destroy_cancellation_handle(handle));
    }

    /// JNI export for `NativeSilentPayments.nativeScan`.
    ///
    /// The mnemonic and passphrase arrays are secret arguments and are never combined with the
    /// public batch array. The method returns the versioned result envelope, including a stable
    /// non-secret error code on recoverable failure. `catch_unwind` contains Rust panics before
    /// they cross JNI. A null result is reserved for JVM allocation failure (or an already
    /// pending JVM exception while creating that result array), because JNI cannot reliably
    /// allocate a replacement envelope.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeScan(
        mut env: JNIEnv,
        _class: JClass,
        mnemonic: JByteArray,
        passphrase: JByteArray,
        public_batch: JByteArray,
        cancellation_handle: jlong,
    ) -> jbyteArray {
        let response = catch_unwind(AssertUnwindSafe(|| {
            if mnemonic.as_raw().is_null()
                || passphrase.as_raw().is_null()
                || public_batch.as_raw().is_null()
            {
                return stable_error(&mut env, NativeErrorCode::InvalidSecret);
            }

            let mnemonic_length = match env.get_array_length(&mnemonic) {
                Ok(length) => length,
                Err(_) => return stable_error(&mut env, NativeErrorCode::Internal),
            };
            let passphrase_length = match env.get_array_length(&passphrase) {
                Ok(length) => length,
                Err(_) => return stable_error(&mut env, NativeErrorCode::Internal),
            };
            let batch_length = match env.get_array_length(&public_batch) {
                Ok(length) => length,
                Err(_) => return stable_error(&mut env, NativeErrorCode::Internal),
            };

            if mnemonic_length < 0 || passphrase_length < 0 || batch_length < 0 {
                return stable_error(&mut env, NativeErrorCode::Internal);
            }
            if mnemonic_length > MAX_SECRET_BYTES || passphrase_length > MAX_SECRET_BYTES {
                return stable_error(&mut env, NativeErrorCode::InvalidSecret);
            }
            if batch_length > MAX_BATCH_BYTES {
                return stable_error(&mut env, NativeErrorCode::ResourceLimit);
            }

            let cancellation = match get_cancellation_handle(cancellation_handle) {
                Some(token) => token,
                None => return stable_error(&mut env, NativeErrorCode::Internal),
            };
            let mnemonic = match env.convert_byte_array(mnemonic) {
                Ok(bytes) => zeroize::Zeroizing::new(bytes),
                Err(_) => return stable_error(&mut env, NativeErrorCode::Internal),
            };
            let passphrase = match env.convert_byte_array(passphrase) {
                Ok(bytes) => zeroize::Zeroizing::new(bytes),
                Err(_) => return stable_error(&mut env, NativeErrorCode::Internal),
            };
            let public_batch = match env.convert_byte_array(public_batch) {
                Ok(bytes) => bytes,
                Err(_) => return stable_error(&mut env, NativeErrorCode::Internal),
            };

            scan_public_batch_with_cancellation(
                &mnemonic,
                &passphrase,
                &public_batch,
                cancellation.as_ref(),
            )
            .map(|result| crate::codec::encode_scan_result(&result))
            .unwrap_or_else(crate::error::encode_error_result)
        }))
        .unwrap_or_else(|_| stable_error(&mut env, NativeErrorCode::Internal));

        match catch_unwind(AssertUnwindSafe(|| env.byte_array_from_slice(&response))) {
            Ok(Ok(array)) => array.into_raw(),
            Ok(Err(_)) | Err(_) => ptr::null_mut(),
        }
    }
}
