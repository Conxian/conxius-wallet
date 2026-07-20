package com.conxius.wallet.bitcoin

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

/** Stable wire errors returned by the Rust JNI boundary. */
enum class NativeErrorCode(val wireCode: Int) {
    INVALID_SECRET(1),
    INVALID_NETWORK(2),
    INVALID_PUBLIC_BATCH(3),
    RESOURCE_LIMIT(4),
    INVALID_PUBLIC_RECORD(5),
    ECC_FAILURE(6),
    INTERNAL(7),
    CANCELLED(8),
    LIBRARY_UNAVAILABLE(0);

    companion object {
        fun fromWireCode(code: Int): NativeErrorCode =
            entries.firstOrNull { it.wireCode == code && it != LIBRARY_UNAVAILABLE }
                ?: INVALID_PUBLIC_BATCH
    }
}

class NativeSilentPaymentException(
    val code: NativeErrorCode,
    cause: Throwable? = null,
) : IllegalStateException("silent payment native operation failed: ${code.name}", cause)

/** Secret-separated scanner seam used by [SilentPaymentManager] and Kotlin unit tests. */
interface NativeSilentPaymentScanner {
    suspend fun scan(
        mnemonicBytes: ByteArray,
        passphraseBytes: ByteArray?,
        publicBatch: ByteArray,
    ): ByteArray
}

/**
* Thin JNI loader. It accepts secret bytes and a public binary batch as separate arguments; it
* never accepts or returns key hex strings. The Rust side returns the versioned result envelope.
*/
object NativeSilentPayments : NativeSilentPaymentScanner {
    private const val LIBRARY_NAME = "conxius_silent_payments_jni"

    @Volatile
    private var libraryLoadFailure: Throwable? = null

    @Volatile
    private var libraryLoadAttempted = false

    override suspend fun scan(
        mnemonicBytes: ByteArray,
        passphraseBytes: ByteArray?,
        publicBatch: ByteArray,
    ): ByteArray = withContext(Dispatchers.IO) {
        ensureLibraryLoaded()
        currentCoroutineContext().ensureActive()
        val cancellationHandle = nativeCreateCancellationHandle()
        if (cancellationHandle == 0L) {
            throw NativeSilentPaymentException(NativeErrorCode.INTERNAL)
        }
        val cancellationRegistration = currentCoroutineContext()[Job]?.invokeOnCompletion { cause ->
            if (cause is CancellationException) {
                runCatching { nativeCancel(cancellationHandle) }
            }
        }
        try {
            nativeScan(
                mnemonicBytes,
                passphraseBytes ?: ByteArray(0),
                publicBatch,
                cancellationHandle,
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: NativeSilentPaymentException) {
            throw error
        } catch (error: Throwable) {
            throw NativeSilentPaymentException(NativeErrorCode.INTERNAL, error)
        } finally {
            cancellationRegistration?.dispose()
            runCatching { nativeDestroyCancellationHandle(cancellationHandle) }
        }
    }

    private fun ensureLibraryLoaded() {
        if (libraryLoadAttempted) {
            libraryLoadFailure?.let { throw NativeSilentPaymentException(NativeErrorCode.LIBRARY_UNAVAILABLE, it) }
            return
        }
        synchronized(this) {
            if (!libraryLoadAttempted) {
                try {
                    System.loadLibrary(LIBRARY_NAME)
                } catch (error: LinkageError) {
                    libraryLoadFailure = error
                } catch (error: SecurityException) {
                    libraryLoadFailure = error
                } finally {
                    libraryLoadAttempted = true
                }
            }
        }
        libraryLoadFailure?.let { throw NativeSilentPaymentException(NativeErrorCode.LIBRARY_UNAVAILABLE, it) }
    }

    @JvmStatic
    private external fun nativeScan(
        mnemonicBytes: ByteArray,
        passphraseBytes: ByteArray,
        publicBatch: ByteArray,
        cancellationHandle: Long,
    ): ByteArray

    @JvmStatic
    private external fun nativeCreateCancellationHandle(): Long

    @JvmStatic
    private external fun nativeCancel(cancellationHandle: Long)

    @JvmStatic
    private external fun nativeDestroyCancellationHandle(cancellationHandle: Long)
}
