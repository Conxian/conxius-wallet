package com.conxius.wallet.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class KeyMintAuthorizationManagerTest {
    @Test
    fun teeAllowedMakesStrongBoxDowngradeExplicit() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(KeySecurityTier.TRUSTED_ENVIRONMENT),
            failStrongBoxGeneration = true,
        )
        val manager = manager(store, strongBoxSupported = true)

        val evidence = manager.createAuthorizationKey(
            AuthorizationKeyRequest(
                alias = "authorization-key",
                policy = AuthorizationPolicy.TEE_ALLOWED,
                attestationChallenge = byteArrayOf(1, 2, 3),
            ),
        )

        assertEquals(
            AuthorizationKeyProvisioningPath.TRUSTED_ENVIRONMENT_FALLBACK,
            evidence.provisioningPath,
        )
        assertEquals(
            AuthorizationKeyFallbackReason.STRONGBOX_GENERATION_FAILED,
            evidence.fallbackReason,
        )
        assertEquals(listOf(true, false), store.requestedStrongBox)
        assertTrue(evidence.requestedAttestationChallengeHash?.isNotEmpty() == true)
    }

    @Test
    fun strongBoxRequiredNeverFallsBackAfterGenerationFailure() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(KeySecurityTier.TRUSTED_ENVIRONMENT),
            failStrongBoxGeneration = true,
        )
        val manager = manager(store, strongBoxSupported = true)

        val error = runCatching {
            manager.createAuthorizationKey(
                AuthorizationKeyRequest(
                    alias = "authorization-key",
                    policy = AuthorizationPolicy.STRONGBOX_REQUIRED,
                    attestationChallenge = byteArrayOf(1, 2, 3),
                ),
            )
        }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.GenerationFailed)
        assertEquals(listOf(true), store.requestedStrongBox)
    }

    @Test
    fun unknownEvidenceIsRejectedAndTheGeneratedKeyIsDeleted() {
        val store = FakeAuthorizationKeyStore(
            storedKey = StoredAuthorizationKey(
                publicKeyEncoded = byteArrayOf(1, 2, 3),
                certificateChain = listOf(byteArrayOf(4, 5, 6)),
                localKeyInfo = LocalKeyInfoEvidence.Unavailable(
                    securityTier = KeySecurityTier.UNKNOWN,
                    apiLevel = 31,
                    source = KeyInfoEvidenceSource.KEY_INFO_UNAVAILABLE,
                    reason = KeyInfoEvidenceReason.KEY_INFO_UNAVAILABLE,
                ),
            ),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.createAuthorizationKey(
                AuthorizationKeyRequest(
                    alias = "authorization-key",
                    policy = AuthorizationPolicy.TEE_ALLOWED,
                    attestationChallenge = byteArrayOf(1, 2, 3),
                ),
            )
        }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.PolicyRejected)
        assertEquals(listOf("authorization-key"), store.deletedAliases)
    }

    @Test
    fun strongBoxRequiredRejectsUnsupportedPlatformBeforeKeyGeneration() {
        val store = FakeAuthorizationKeyStore(storedKey(KeySecurityTier.STRONGBOX))
        val manager = manager(store, strongBoxSupported = false, apiLevel = 27)

        val error = runCatching {
            manager.createAuthorizationKey(
                AuthorizationKeyRequest(
                    alias = "authorization-key",
                    policy = AuthorizationPolicy.STRONGBOX_REQUIRED,
                    attestationChallenge = byteArrayOf(1, 2, 3),
                ),
            )
        }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.PolicyRejected)
        assertEquals(emptyList<Boolean>(), store.requestedStrongBox)
    }

    private fun manager(
        store: FakeAuthorizationKeyStore,
        strongBoxSupported: Boolean,
        apiLevel: Int = 31,
    ) = KeyMintAuthorizationManager(
        keyStore = store,
        packageSigningIdentity = PackageSigningIdentity(
            packageName = "com.conxius.wallet",
            signingCertificateSha256 = listOf("cert-a"),
        ),
        strongBoxSupported = strongBoxSupported,
        apiLevel = apiLevel,
    )

    private fun storedKey(tier: KeySecurityTier) = StoredAuthorizationKey(
        publicKeyEncoded = byteArrayOf(1, 2, 3),
        certificateChain = listOf(byteArrayOf(4, 5, 6)),
        localKeyInfo = LocalKeyInfoEvidence.Available(
            securityTier = tier,
            apiLevel = 31,
            source = KeyInfoEvidenceSource.KEY_INFO_SECURITY_LEVEL,
            securityLevel = null,
            isInsideSecureHardware = tier != KeySecurityTier.SOFTWARE,
            keyAlgorithm = "EC",
            keySize = 256,
            purposes = 4,
            digests = setOf("SHA-256"),
            userAuthenticationRequired = false,
            strongBoxLevelKnown = tier == KeySecurityTier.STRONGBOX,
        ),
    )

    private class FakeAuthorizationKeyStore(
        private val storedKey: StoredAuthorizationKey,
        private val failStrongBoxGeneration: Boolean = false,
    ) : AuthorizationKeyStore {
        val requestedStrongBox = mutableListOf<Boolean>()
        val deletedAliases = mutableListOf<String>()

        override fun containsAlias(alias: String): Boolean = false

        override fun create(
            alias: String,
            attestationChallenge: ByteArray,
            requestStrongBox: Boolean,
        ): StoredAuthorizationKey {
            requestedStrongBox += requestStrongBox
            if (requestStrongBox && failStrongBoxGeneration) {
                throw IllegalStateException("StrongBox unavailable in test")
            }
            return storedKey
        }

        override fun inspect(alias: String): StoredAuthorizationKey = storedKey

        override fun delete(alias: String) {
            deletedAliases += alias
        }
    }
}
