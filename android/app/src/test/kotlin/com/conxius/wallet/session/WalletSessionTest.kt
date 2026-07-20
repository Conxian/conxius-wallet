package com.conxius.wallet.session

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WalletSessionTest {
    @Test
    fun invalidationBeforePersistenceRejectsStaleGeneration() = runBlocking {
        val session = WalletSession()
        session.markAuthenticated()
        val originalGeneration = session.generation
        var persisted = false

        session.invalidateForWalletMutation()
        val result = session.withActiveGeneration(originalGeneration) {
            persisted = true
        }

        assertNull(result)
        assertFalse(persisted)
        assertNotEquals(originalGeneration, session.generation)
        assertFalse(session.isUnlocked.value)
    }

    @Test
    fun clearAuthenticationWaitsForInFlightPersistence() = runBlocking {
        assertInvalidationWaitsForPersistence { clearAuthentication() }
    }

    @Test
    fun walletMutationInvalidationWaitsForInFlightPersistence() = runBlocking {
        assertInvalidationWaitsForPersistence { invalidateForWalletMutation() }
    }

    private suspend fun assertInvalidationWaitsForPersistence(
        invalidate: suspend WalletSession.() -> Unit,
    ) = coroutineScope {
        val session = WalletSession()
        session.markAuthenticated()
        val originalGeneration = session.generation
        val events = mutableListOf<String>()
        val persistenceStarted = CompletableDeferred<Unit>()
        val releasePersistence = CompletableDeferred<Unit>()

        val persistenceJob = launch {
            val result = session.withActiveGeneration(originalGeneration) {
                events += "persistence-started"
                persistenceStarted.complete(Unit)
                releasePersistence.await()
                events += "persistence-committed"
                "persisted"
            }
            assertEquals("persisted", result)
        }
        persistenceStarted.await()

        val invalidationJob = launch {
            session.invalidate()
            events += "invalidation-completed"
        }
        yield()

        assertFalse(invalidationJob.isCompleted)
        assertEquals(originalGeneration, session.generation)
        assertTrue(session.isUnlocked.value)
        assertEquals(listOf("persistence-started"), events)

        releasePersistence.complete(Unit)
        persistenceJob.join()
        invalidationJob.join()

        assertEquals(
            listOf("persistence-started", "persistence-committed", "invalidation-completed"),
            events,
        )
        assertNotEquals(originalGeneration, session.generation)
        assertFalse(session.isUnlocked.value)

        val staleResult = session.withActiveGeneration(originalGeneration) {
            events += "stale-commit"
        }
        assertNull(staleResult)
        assertFalse(events.contains("stale-commit"))
    }
}
