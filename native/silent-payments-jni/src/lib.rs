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
        Env, EnvUnowned,
    };

    use crate::{error::NativeErrorCode, scan::scan_public_batch_with_cancellation};

    const MAX_SECRET_BYTES: usize = crate::codec::MAX_MNEMONIC_BYTES;
    const MAX_BATCH_BYTES: usize = crate::codec::MAX_BATCH_BYTES;

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

    fn clear_pending_exception(env: &mut Env<'_>) {
        if env.exception_check() {
            env.exception_clear();
        }
    }

    fn stable_error(env: &mut Env<'_>, code: NativeErrorCode) -> Vec<u8> {
        clear_pending_exception(env);
        crate::error::encode_error_result(code)
    }

    /// Create a cooperative cancellation token for one blocking native scan.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeCreateCancellationHandle<
        'local,
    >(
        mut unowned_env: EnvUnowned<'local>,
        _class: JClass<'local>,
    ) -> jlong {
        match catch_unwind(AssertUnwindSafe(|| {
            unowned_env
                .with_env(|_| -> Result<jlong, jni::errors::Error> {
                    Ok(create_cancellation_handle())
                })
                .into_outcome()
        })) {
            Ok(jni::Outcome::Ok(handle)) => handle,
            Ok(jni::Outcome::Err(_)) | Ok(jni::Outcome::Panic(_)) | Err(_) => 0,
        }
    }

    /// Mark one native scan token cancelled. The core checks the flag between records and in its
    /// bounded BIP-352 output-index loop; it cannot interrupt an individual secp256k1 primitive.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeCancel<
        'local,
    >(
        mut unowned_env: EnvUnowned<'local>,
        _class: JClass<'local>,
        handle: jlong,
    ) {
        let _ = catch_unwind(AssertUnwindSafe(|| {
            let _ = unowned_env
                .with_env(|_| -> Result<(), jni::errors::Error> {
                    cancel_cancellation_handle(handle);
                    Ok(())
                })
                .into_outcome();
        }));
    }

    /// Release one native scan token after the Kotlin coroutine has completed.
    #[no_mangle]
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeDestroyCancellationHandle<
        'local,
    >(
        mut unowned_env: EnvUnowned<'local>,
        _class: JClass<'local>,
        handle: jlong,
    ) {
        let _ = catch_unwind(AssertUnwindSafe(|| {
            let _ = unowned_env
                .with_env(|_| -> Result<(), jni::errors::Error> {
                    destroy_cancellation_handle(handle);
                    Ok(())
                })
                .into_outcome();
        }));
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
    pub extern "system" fn Java_com_conxius_wallet_bitcoin_NativeSilentPayments_nativeScan<
        'local,
    >(
        mut unowned_env: EnvUnowned<'local>,
        _class: JClass<'local>,
        mnemonic: JByteArray<'local>,
        passphrase: JByteArray<'local>,
        public_batch: JByteArray<'local>,
        cancellation_handle: jlong,
    ) -> jbyteArray {
        match unowned_env
            .with_env(|env| -> Result<JByteArray<'local>, jni::errors::Error> {
                let response = catch_unwind(AssertUnwindSafe(|| {
                    if mnemonic.as_raw().is_null()
                        || passphrase.as_raw().is_null()
                        || public_batch.as_raw().is_null()
                    {
                        return stable_error(env, NativeErrorCode::InvalidSecret);
                    }

                    let mnemonic_length = match mnemonic.len(env) {
                        Ok(length) => length,
                        Err(_) => return stable_error(env, NativeErrorCode::Internal),
                    };
                    let passphrase_length = match passphrase.len(env) {
                        Ok(length) => length,
                        Err(_) => return stable_error(env, NativeErrorCode::Internal),
                    };
                    let batch_length = match public_batch.len(env) {
                        Ok(length) => length,
                        Err(_) => return stable_error(env, NativeErrorCode::Internal),
                    };

                    if mnemonic_length > MAX_SECRET_BYTES || passphrase_length > MAX_SECRET_BYTES {
                        return stable_error(env, NativeErrorCode::InvalidSecret);
                    }
                    if batch_length > MAX_BATCH_BYTES {
                        return stable_error(env, NativeErrorCode::ResourceLimit);
                    }

                    let cancellation = match get_cancellation_handle(cancellation_handle) {
                        Some(token) => token,
                        None => return stable_error(env, NativeErrorCode::Internal),
                    };
                    let mnemonic = match env.convert_byte_array(mnemonic) {
                        Ok(bytes) => zeroize::Zeroizing::new(bytes),
                        Err(_) => return stable_error(env, NativeErrorCode::Internal),
                    };
                    let passphrase = match env.convert_byte_array(passphrase) {
                        Ok(bytes) => zeroize::Zeroizing::new(bytes),
                        Err(_) => return stable_error(env, NativeErrorCode::Internal),
                    };
                    let public_batch = match env.convert_byte_array(public_batch) {
                        Ok(bytes) => bytes,
                        Err(_) => return stable_error(env, NativeErrorCode::Internal),
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
                .unwrap_or_else(|_| stable_error(env, NativeErrorCode::Internal));

                env.byte_array_from_slice(&response)
            })
            .into_outcome()
        {
            jni::Outcome::Ok(array) => array.into_raw(),
            jni::Outcome::Err(_) | jni::Outcome::Panic(_) => ptr::null_mut(),
        }
    }
}
