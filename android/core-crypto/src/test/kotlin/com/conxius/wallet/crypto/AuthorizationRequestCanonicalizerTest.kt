package com.conxius.wallet.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthorizationRequestCanonicalizerTest {
    @Test
    fun canonicalBindingIsDeterministicAndNormalizesCertificateOrder() {
        val first = request(
            certificates = listOf("CERT-B", "cert-a", "cert-a"),
        )
        val second = request(
            certificates = listOf("cert-a", "cert-b"),
        )

        val firstCanonical = AuthorizationRequestCanonicalizer.canonicalize(first)
        val secondCanonical = AuthorizationRequestCanonicalizer.canonicalize(second)
        val firstHash = AuthorizationRequestCanonicalizer.requestHash(first)
        val secondHash = AuthorizationRequestCanonicalizer.requestHash(second)

        assertArrayEquals(firstCanonical, secondCanonical)
        assertArrayEquals(firstHash, secondHash)
        assertTrue(firstHash.isNotEmpty())
        assertEquals(
            "3e05250f231860b23abfe345ad63fbef34efbbaff2d113be05873a639911273a",
            firstHash.toLowerHex(),
        )
    }

    @Test
    fun requestHashChangesWhenAnAuthorizationBindingInputChanges() {
        val original = request()
        val changedOperation = CanonicalAuthorizationRequest(
            operationDigest = byteArrayOf(9, 8, 7),
            nonce = byteArrayOf(4, 5, 6),
            attestationChallenge = byteArrayOf(1, 2, 3),
            keyIdentity = "sha256:key",
            packageSigningIdentity = PackageSigningIdentity(
                packageName = "com.conxius.wallet",
                signingCertificateSha256 = listOf("cert-a"),
            ),
            policy = AuthorizationPolicy.TEE_ALLOWED,
        )
        val changedPolicy = CanonicalAuthorizationRequest(
            operationDigest = byteArrayOf(1, 2, 3),
            nonce = byteArrayOf(4, 5, 6),
            attestationChallenge = byteArrayOf(7, 8, 9),
            keyIdentity = "sha256:key",
            packageSigningIdentity = PackageSigningIdentity(
                packageName = "com.conxius.wallet",
                signingCertificateSha256 = listOf("cert-a"),
            ),
            policy = AuthorizationPolicy.STRONGBOX_REQUIRED,
        )

        assertFalse(
            AuthorizationRequestCanonicalizer.requestHash(original)
                .contentEquals(AuthorizationRequestCanonicalizer.requestHash(changedOperation)),
        )
        assertFalse(
            AuthorizationRequestCanonicalizer.requestHash(original)
                .contentEquals(AuthorizationRequestCanonicalizer.requestHash(changedPolicy)),
        )
        assertNotEquals(
            AuthorizationRequestCanonicalizer.canonicalize(original).toList(),
            AuthorizationRequestCanonicalizer.canonicalize(changedOperation).toList(),
        )
    }

    @Test
    fun requestInputsAreDefensivelyCopied() {
        val operationDigest = byteArrayOf(1, 2, 3)
        val request = CanonicalAuthorizationRequest(
            operationDigest = operationDigest,
            nonce = byteArrayOf(4, 5, 6),
            attestationChallenge = byteArrayOf(7, 8, 9),
            keyIdentity = "sha256:key",
            packageSigningIdentity = PackageSigningIdentity(
                packageName = "com.conxius.wallet",
                signingCertificateSha256 = listOf("cert-a"),
            ),
            policy = AuthorizationPolicy.TEE_ALLOWED,
        )

        operationDigest[0] = 99

        assertArrayEquals(byteArrayOf(1, 2, 3), request.operationDigest)
    }

    private fun request(
        certificates: List<String> = listOf("cert-a"),
    ) = CanonicalAuthorizationRequest(
        operationDigest = byteArrayOf(1, 2, 3),
        nonce = byteArrayOf(4, 5, 6),
        attestationChallenge = byteArrayOf(7, 8, 9),
        keyIdentity = "sha256:key",
        packageSigningIdentity = PackageSigningIdentity(
            packageName = "com.conxius.wallet",
            signingCertificateSha256 = certificates,
        ),
        policy = AuthorizationPolicy.TEE_ALLOWED,
    )

    private fun ByteArray.toLowerHex(): String = joinToString("") { byte ->
        "%02x".format(byte.toInt() and 0xff)
    }
}
