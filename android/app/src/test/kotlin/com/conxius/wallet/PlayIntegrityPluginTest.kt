package com.conxius.wallet

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayIntegrityPluginTest {
    @Test
    fun rejectsBlankRequestHashBeforePreparation() = runBlocking {
        val client = RecordingClient()
        val plugin = PlayIntegrityPlugin(cloudProjectNumber = 7L, client = client)

        val error = runCatching { plugin.requestIntegrityToken(" \t\n") }.exceptionOrNull()

        assertTrue(error is PlayIntegrityException.InvalidRequestHash)
        assertEquals(0, client.prepareCount)
    }

    @Test
    fun rejectsRequestHashOverTheSdkByteLimit() = runBlocking {
        val client = RecordingClient()
        val plugin = PlayIntegrityPlugin(cloudProjectNumber = 7L, client = client)
        val oversizedHash = "é".repeat(251)

        val error = runCatching { plugin.requestIntegrityToken(oversizedHash) }.exceptionOrNull()

        assertTrue(error is PlayIntegrityException.InvalidRequestHash)
        assertEquals(502, oversizedHash.toByteArray(Charsets.UTF_8).size)
        assertEquals(0, client.prepareCount)
    }

    @Test
    fun passesExactRequestHashAndReturnsOpaqueTokenUnchanged() = runBlocking {
        val requestHash = "  canonical-request-hash/with-padding  "
        val opaqueToken = "eyJ-encrypted.and.signed.token=="
        val client = RecordingClient { opaqueToken }
        val plugin = PlayIntegrityPlugin(cloudProjectNumber = 7L, client = client)

        val actualToken = plugin.requestIntegrityToken(requestHash)

        assertEquals(opaqueToken, actualToken)
        assertEquals(listOf(requestHash), client.requestHashes)
    }

    @Test
    fun cachesPreparedProviderAcrossRequests() = runBlocking {
        val client = RecordingClient { requestHash -> "opaque:$requestHash" }
        val plugin = PlayIntegrityPlugin(cloudProjectNumber = 4_200L, client = client)

        assertEquals("opaque:first", plugin.requestIntegrityToken("first"))
        assertEquals("opaque:second", plugin.requestIntegrityToken("second"))

        assertEquals(1, client.prepareCount)
        assertEquals(listOf(4_200L), client.projectNumbers)
        assertEquals(listOf("first", "second"), client.requestHashes)
    }

    @Test
    fun rejectsMissingAndNonPositiveProjectConfiguration() = runBlocking {
        listOf(null, 0L, -1L).forEach { projectNumber ->
            val client = RecordingClient()
            val plugin = PlayIntegrityPlugin(cloudProjectNumber = projectNumber, client = client)

            val error = runCatching { plugin.requestIntegrityToken("hash") }.exceptionOrNull()

            assertTrue(error is PlayIntegrityException.InvalidCloudProjectNumber)
            assertEquals(0, client.prepareCount)
        }
    }

    @Test
    fun preparationFailureDoesNotProduceFallbackToken() = runBlocking {
        val client = RecordingClient(prepareFailure = IllegalStateException("prepare failed"))
        val plugin = PlayIntegrityPlugin(cloudProjectNumber = 7L, client = client)

        val error = runCatching { plugin.requestIntegrityToken("hash") }.exceptionOrNull()

        assertTrue(error is PlayIntegrityException.PreparationFailed)
        assertEquals(1, client.prepareCount)
    }

    @Test
    fun requestFailureFailsClosedAndInvalidatesCachedProvider() = runBlocking {
        val client = RecordingClient(requestFailure = IllegalStateException("request failed"))
        val plugin = PlayIntegrityPlugin(cloudProjectNumber = 7L, client = client)

        val firstError = runCatching { plugin.requestIntegrityToken("first") }.exceptionOrNull()
        val secondError = runCatching { plugin.requestIntegrityToken("second") }.exceptionOrNull()

        assertTrue(firstError is PlayIntegrityException.RequestFailed)
        assertTrue(secondError is PlayIntegrityException.RequestFailed)
        assertEquals(2, client.prepareCount)
    }

    private class RecordingClient(
        private val tokenFactory: (String) -> String = { requestHash -> "opaque:$requestHash" },
        private val prepareFailure: Throwable? = null,
        private val requestFailure: Throwable? = null,
    ) : PlayIntegrityClient {
        var prepareCount = 0
        val projectNumbers = mutableListOf<Long>()
        val requestHashes = mutableListOf<String>()

        override suspend fun prepare(cloudProjectNumber: Long): PlayIntegrityTokenProvider {
            prepareCount += 1
            projectNumbers += cloudProjectNumber
            prepareFailure?.let { throw it }

            return PlayIntegrityTokenProvider { requestHash ->
                requestHashes += requestHash
                requestFailure?.let { throw it }
                tokenFactory(requestHash)
            }
        }
    }
}
