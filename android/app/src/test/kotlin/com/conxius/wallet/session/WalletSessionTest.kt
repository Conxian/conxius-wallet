package com.conxius.wallet.session

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WalletSessionTest {
    @Test
    fun generationGateRejectsLatePersistenceAfterWalletMutation() = runBlocking {
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
}
