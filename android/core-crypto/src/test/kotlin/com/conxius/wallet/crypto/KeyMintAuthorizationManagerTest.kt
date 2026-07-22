package com.conxius.wallet.crypto

import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class KeyMintAuthorizationManagerTest {
    @Test
    fun teeAllowedFallsBackOnlyForExplicitStrongBoxUnavailable() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(),
            createFailure = StrongBoxUnavailableException("StrongBox unavailable in test"),
        )
        val manager = manager(store, strongBoxSupported = true)

        val evidence = manager.createAuthorizationKey(request())

        assertEquals(
            AuthorizationKeyProvisioningPath.TRUSTED_ENVIRONMENT_FALLBACK,
            evidence.provisioningPath,
        )
        assertEquals(
            AuthorizationKeyFallbackReason.STRONGBOX_UNAVAILABLE,
            evidence.fallbackReason,
        )
        assertEquals(listOf(true, false), store.requestedStrongBox)
        assertTrue(evidence.requestedAttestationChallengeHash?.isNotEmpty() == true)
    }

    @Test
    fun teeAllowedDoesNotFallbackForGenericProviderFailure() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(),
            createFailure = IllegalStateException("provider failure in test"),
        )
        val manager = manager(store, strongBoxSupported = true)

        val error = runCatching { manager.createAuthorizationKey(request()) }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.GenerationFailed)
        assertEquals(listOf(true), store.requestedStrongBox)
    }

    @Test
    fun strongBoxRequiredNeverFallsBackAfterStrongBoxUnavailable() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(),
            createFailure = StrongBoxUnavailableException("StrongBox unavailable in test"),
        )
        val manager = manager(store, strongBoxSupported = true)

        val error = runCatching {
            manager.createAuthorizationKey(
                request(policy = AuthorizationPolicy.STRONGBOX_REQUIRED),
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

        val error = runCatching { manager.createAuthorizationKey(request()) }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.PolicyRejected)
        assertEquals(listOf(alias()), store.deletedAliases)
    }

    @Test
    fun strongBoxRequiredRejectsUnsupportedPlatformBeforeKeyGeneration() {
        val store = FakeAuthorizationKeyStore(storedKey())
        val manager = manager(store, strongBoxSupported = false, apiLevel = 27)

        val error = runCatching {
            manager.createAuthorizationKey(request(policy = AuthorizationPolicy.STRONGBOX_REQUIRED))
        }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.PolicyRejected)
        assertEquals(emptyList<Boolean>(), store.requestedStrongBox)
    }

    @Test
    fun existingManagerOwnedKeyMustProveTheCompleteP256SigningProfile() {
        val store = FakeAuthorizationKeyStore(storedKey())
        val manager = manager(store, strongBoxSupported = false)

        val evidence = manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)

        assertEquals(AuthorizationKeyProvisioningPath.EXISTING_KEY, evidence.provisioningPath)
        assertEquals(listOf(alias()), store.inspectedAliases)
    }

    @Test
    fun p384KeyProfileIsRejectedBeforePolicyAcceptance() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(
                certificate = P384_CERTIFICATE,
                publicKey = P384_PUBLIC_KEY,
                keySize = 384,
            ),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertProfileReason(error, AuthorizationKeyProfileReason.KEY_SIZE_MISMATCH)
    }

    @Test
    fun p384CertificateIsRejectedEvenIfReportedKeySizeIsFalsely256() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(
                certificate = P384_CERTIFICATE,
                publicKey = P384_PUBLIC_KEY,
            ),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertProfileReason(error, AuthorizationKeyProfileReason.EC_CURVE_MISMATCH)
    }

    @Test
    fun wrongPurposeIsRejected() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(
                purposes = KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
            ),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertProfileReason(error, AuthorizationKeyProfileReason.KEY_PURPOSES_MISMATCH)
    }

    @Test
    fun wrongDigestIsRejected() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(digests = setOf(KeyProperties.DIGEST_SHA384)),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertProfileReason(error, AuthorizationKeyProfileReason.KEY_DIGESTS_MISMATCH)
    }

    @Test
    fun certificateAndPublicKeyMustMatch() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(publicKey = P384_PUBLIC_KEY),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertProfileReason(error, AuthorizationKeyProfileReason.CERTIFICATE_PUBLIC_KEY_MISMATCH)
    }

    @Test
    fun inspectedKeystoreAliasMustMatchTheRequestedManagerAlias() {
        val store = FakeAuthorizationKeyStore(
            storedKey = storedKey(keystoreAlias = alias("different-key")),
        )
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey(alias(), AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertProfileReason(error, AuthorizationKeyProfileReason.KEYSTORE_ALIAS_MISMATCH)
    }

    @Test
    fun unmanagedAliasIsRejectedBeforeInspection() {
        val store = FakeAuthorizationKeyStore(storedKey())
        val manager = manager(store, strongBoxSupported = false)

        val error = runCatching {
            manager.inspectAuthorizationKey("ConxiusSeedKey", AuthorizationPolicy.TEE_ALLOWED)
        }.exceptionOrNull()

        assertTrue(error is KeyMintAuthorizationException.InvalidAlias)
        assertEquals(emptyList<String>(), store.inspectedAliases)
        assertEquals(emptyList<String>(), store.deletedAliases)
    }

    @Test
    fun attestationChallengeMustBeNonEmptyAndAtMost128Bytes() {
        val emptyError = runCatching {
            AuthorizationKeyRequest(
                alias = alias(),
                policy = AuthorizationPolicy.TEE_ALLOWED,
                attestationChallenge = byteArrayOf(),
            )
        }.exceptionOrNull()
        val oversizedError = runCatching {
            AuthorizationKeyRequest(
                alias = alias(),
                policy = AuthorizationPolicy.TEE_ALLOWED,
                attestationChallenge = ByteArray(MAX_ATTESTATION_CHALLENGE_BYTES + 1),
            )
        }.exceptionOrNull()
        val accepted = AuthorizationKeyRequest(
            alias = alias(),
            policy = AuthorizationPolicy.TEE_ALLOWED,
            attestationChallenge = ByteArray(MAX_ATTESTATION_CHALLENGE_BYTES),
        )

        assertTrue(emptyError is IllegalArgumentException)
        assertTrue(oversizedError is IllegalArgumentException)
        assertEquals(MAX_ATTESTATION_CHALLENGE_BYTES, accepted.attestationChallenge.size)
    }

    private fun assertProfileReason(
        error: Throwable?,
        expected: AuthorizationKeyProfileReason,
    ) {
        assertTrue(error is KeyMintAuthorizationException.KeyProfileRejected)
        assertEquals(expected, (error as KeyMintAuthorizationException.KeyProfileRejected).reason)
    }

    private fun request(
        policy: AuthorizationPolicy = AuthorizationPolicy.TEE_ALLOWED,
    ) = AuthorizationKeyRequest(
        alias = alias(),
        policy = policy,
        attestationChallenge = byteArrayOf(1, 2, 3),
    )

    private fun alias(suffix: String = "authorization-key") =
        "$AUTHORIZATION_KEY_ALIAS_PREFIX$suffix"

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

    private fun storedKey(
        tier: KeySecurityTier = KeySecurityTier.TRUSTED_ENVIRONMENT,
        keyAlgorithm: String = KeyProperties.KEY_ALGORITHM_EC,
        keySize: Int = 256,
        purposes: Int = KeyProperties.PURPOSE_SIGN,
        digests: Set<String> = setOf(KeyProperties.DIGEST_SHA256),
        certificate: ByteArray = P256_CERTIFICATE,
        publicKey: ByteArray = P256_PUBLIC_KEY,
        keystoreAlias: String? = null,
    ) = StoredAuthorizationKey(
        publicKeyEncoded = publicKey,
        certificateChain = listOf(certificate),
        localKeyInfo = LocalKeyInfoEvidence.Available(
            securityTier = tier,
            apiLevel = 31,
            source = KeyInfoEvidenceSource.KEY_INFO_SECURITY_LEVEL,
            securityLevel = null,
            isInsideSecureHardware = tier != KeySecurityTier.SOFTWARE,
            keyAlgorithm = keyAlgorithm,
            keySize = keySize,
            purposes = purposes,
            digests = digests,
            userAuthenticationRequired = false,
            strongBoxLevelKnown = tier == KeySecurityTier.STRONGBOX,
        ),
        keystoreAlias = keystoreAlias,
    )

    private class FakeAuthorizationKeyStore(
        private val storedKey: StoredAuthorizationKey,
        private val createFailure: Throwable? = null,
    ) : AuthorizationKeyStore {
        val requestedStrongBox = mutableListOf<Boolean>()
        val inspectedAliases = mutableListOf<String>()
        val deletedAliases = mutableListOf<String>()

        override fun containsAlias(alias: String): Boolean = false

        override fun create(
            alias: String,
            attestationChallenge: ByteArray,
            requestStrongBox: Boolean,
        ): StoredAuthorizationKey {
            requestedStrongBox += requestStrongBox
            if (requestStrongBox && createFailure != null) {
                throw createFailure
            }
            return storedKey.copy(keystoreAlias = storedKey.keystoreAlias ?: alias)
        }

        override fun inspect(alias: String): StoredAuthorizationKey {
            inspectedAliases += alias
            return storedKey.copy(keystoreAlias = storedKey.keystoreAlias ?: alias)
        }

        override fun delete(alias: String) {
            deletedAliases += alias
        }
    }

    private companion object {
        val P256_CERTIFICATE = Base64.getDecoder().decode(
            "MIIBjTCCATOgAwIBAgIUJ1moTX6xgfAFTY/7VgGPIRIIxWYwCgYIKoZIzj0EAwIwHDEaMBgGA1UEAwwRQ29ueGl1cyB0ZXN0IFAyNTYwHhcNMjYwNzIyMTQ1NTExWhcNMzYwNzE5MTQ1NTExWjAcMRowGAYDVQQDDBFDb254aXVzIHRlc3QgUDI1NjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABFVofVRpGQloi3gdSqwViN2YNIU4ehD8QCUQGE0NiP/ndijntMzvfvM3LgEPdSO4iJmuATlLSrKTOwbER2MXkHSjUzBRMB0GA1UdDgQWBBSTlmtFqv0p/BMq3i0W6dAwEw/jKTAfBgNVHSMEGDAWgBSTlmtFqv0p/BMq3i0W6dAwEw/jKTAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIQDxM4h48koSlbkRsoAQ7JptaAU05KPoxLOi8nOQkPNmTAIge8Jlx63RTQrwQZg873ZkJZhhm5nLJgvKv570wfiXQz8=",
        )
        val P256_PUBLIC_KEY = Base64.getDecoder().decode(
            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEVWh9VGkZCWiLeB1KrBWI3Zg0hTh6EPxAJRAYTQ2I/+d2KOe0zO9+8zcuAQ91I7iIma4BOUtKspM7BsRHYxeQdA==",
        )
        val P384_CERTIFICATE = Base64.getDecoder().decode(
            "MIIByjCCAVCgAwIBAgIUfZdQYgCZQ/qVjzFl0sAEM+DWRI0wCgYIKoZIzj0EAwMwHDEaMBgGA1UEAwwRQ29ueGl1cyB0ZXN0IFAzODQwHhcNMjYwNzIyMTQ1NTExWhcNMzYwNzE5MTQ1NTExWjAcMRowGAYDVQQDDBFDb254aXVzIHRlc3QgUDM4NDB2MBAGByqGSM49AgEGBSuBBAAiA2IABOi6zv1AzCwblAS9KzKKdRs1Q/gx2MUdrude6Cj3eGMYWcA9D1kQIISxA5ECAV1bwbp0WkYyrwW5uChdq16zmKxq+pqwWTii+Fxd3PlmzAk/XtR633kQAhRr8K/UyI20IKNTMFEwHQYDVR0OBBYEFC33vw8lUe7v+fKG9LI2+m46avWRMB8GA1UdIwQYMBaAFC33vw8lUe7v+fKG9LI2+m46avWRMA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwMDaAAwZQIwNiebWVJglTDmcAFeHeP3H20B4+1iBeaHyS2vZEm8XrhWopYQqMdgQOyQrMrQ/Ak8AjEAhWkCQhFmoeLJVJM6TSaUys1zm92XdLSBSKKB+DiBw1eKdOmtmbJ49wA7l3QEUsVa",
        )
        val P384_PUBLIC_KEY = Base64.getDecoder().decode(
            "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE6LrO/UDMLBuUBL0rMop1GzVD+DHYxR2u517oKPd4YxhZwD0PWRAghLEDkQIBXVvBunRaRjKvBbm4KF2rXrOYrGr6mrBZOKL4XF3c+WbMCT9e1HrfeRACFGvwr9TIjbQg",
        )
    }
}
