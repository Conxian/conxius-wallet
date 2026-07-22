package com.conxius.wallet

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.nio.charset.StandardCharsets

/**
* The smallest seam needed to test this boundary without a Play Store device.
* The token remains opaque to the caller and to this interface.
*/
fun interface PlayIntegrityTokenProvider {
    suspend fun request(requestHash: String): String
}

/**
* Standard API preparation seam. Implementations must not decode or interpret
* the returned token.
*/
fun interface PlayIntegrityClient {
    suspend fun prepare(cloudProjectNumber: Long): PlayIntegrityTokenProvider
}

/** Fail-closed errors from the client-side Play Integrity boundary. */
sealed class PlayIntegrityException(
    message: String,
    cause: Throwable? = null,
) : IllegalStateException(message, cause) {
    class InvalidCloudProjectNumber : PlayIntegrityException(
        "Play Integrity cloud project number is missing or non-positive",
    )

    class InvalidRequestHash : PlayIntegrityException(
        "Play Integrity request hash is blank or exceeds the 500-byte limit",
    )

    class PreparationFailed(cause: Throwable) : PlayIntegrityException(
        "Play Integrity token provider preparation failed",
        cause,
    )

    class RequestFailed(cause: Throwable) : PlayIntegrityException(
        "Play Integrity token request failed",
        cause,
    )
}

/**
* Client-only boundary for the Play Integrity Standard API.
*
* This class only prepares a provider, binds the caller's canonical request
* hash, and returns Google's opaque token. It never decodes a token, inspects
* a verdict, makes a local trust decision, or gates wallet operations.
*/
class PlayIntegrityPlugin(
    private val cloudProjectNumber: Long?,
    private val client: PlayIntegrityClient,
) {
    constructor(
        context: Context,
        configuredCloudProjectNumber: String? = BuildConfig.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER,
    ) : this(
        cloudProjectNumber = configuredCloudProjectNumber?.trim()?.toLongOrNull(),
        client = GooglePlayIntegrityClient(context.applicationContext),
    )

    private val preparationMutex = Mutex()

    @Volatile
    private var preparedProvider: PlayIntegrityTokenProvider? = null

    /**
     * Requests an opaque Standard API token for the exact supplied request hash.
     *
     * The hash is validated for transport limits but is otherwise passed
     * unchanged to the SDK. Preparation is cached in memory and is retried only
     * after a failed preparation or request; no token or verdict is cached.
     */
    suspend fun requestIntegrityToken(requestHash: String): String {
        validateConfiguration()
        validateRequestHash(requestHash)

        val provider = ensurePreparedProvider()
        return try {
            provider.request(requestHash)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            invalidate(provider)
            throw PlayIntegrityException.RequestFailed(error)
        }
    }

    private suspend fun ensurePreparedProvider(): PlayIntegrityTokenProvider {
        preparedProvider?.let { return it }

        return preparationMutex.withLock {
            preparedProvider?.let { return@withLock it }

            val projectNumber = cloudProjectNumber
                ?: throw PlayIntegrityException.InvalidCloudProjectNumber()

            val provider = try {
                client.prepare(projectNumber)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                throw PlayIntegrityException.PreparationFailed(error)
            }

            preparedProvider = provider
            provider
        }
    }

    private fun invalidate(provider: PlayIntegrityTokenProvider) {
        if (preparedProvider === provider) {
            preparedProvider = null
        }
    }

    private fun validateConfiguration() {
        if (cloudProjectNumber == null || cloudProjectNumber <= 0L) {
            throw PlayIntegrityException.InvalidCloudProjectNumber()
        }
    }

    private fun validateRequestHash(requestHash: String) {
        if (requestHash.isBlank() ||
            requestHash.toByteArray(StandardCharsets.UTF_8).size > MAX_REQUEST_HASH_BYTES
        ) {
            throw PlayIntegrityException.InvalidRequestHash()
        }
    }

    companion object {
        const val MAX_REQUEST_HASH_BYTES = 500
    }
}

private class GooglePlayIntegrityClient(
    context: Context,
) : PlayIntegrityClient {
    private val standardIntegrityManager = IntegrityManagerFactory.createStandard(context)

    override suspend fun prepare(cloudProjectNumber: Long): PlayIntegrityTokenProvider {
        val request = StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
            .setCloudProjectNumber(cloudProjectNumber)
            .build()

        val provider = standardIntegrityManager.prepareIntegrityToken(request).awaitResult()
        return GooglePlayIntegrityTokenProvider(provider)
    }
}

private class GooglePlayIntegrityTokenProvider(
    private val provider: StandardIntegrityManager.StandardIntegrityTokenProvider,
) : PlayIntegrityTokenProvider {
    override suspend fun request(requestHash: String): String {
        val request = StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
            .setRequestHash(requestHash)
            .build()

        return provider.request(request).awaitResult().token()
    }
}

private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
    addOnCompleteListener { task ->
        if (!continuation.isActive) return@addOnCompleteListener

        when {
            task.isCanceled -> continuation.cancel(
                CancellationException("Play Integrity task was canceled"),
            )

            task.exception != null -> continuation.resumeWith(
                Result.failure(task.exception!!),
            )

            else -> continuation.resumeWith(Result.success(task.result))
        }
    }
}
