package com.conxius.wallet.crypto

import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets
import java.util.Locale

/**
* Package identity used for request binding.
*
* Certificate digests are normalized and sorted so the same signing identity
* has one canonical representation regardless of platform ordering.
*/
class PackageSigningIdentity(
    packageName: String,
    signingCertificateSha256: List<String>,
) {
    val packageName: String = packageName.trim().also {
        require(it.isNotEmpty()) { "packageName must not be blank" }
    }

    val signingCertificateSha256: List<String> = signingCertificateSha256
        .map { it.trim().lowercase(Locale.US) }
        .filter { it.isNotEmpty() }
        .distinct()
        .sorted()
        .also {
            require(it.isNotEmpty()) {
                "at least one signing certificate digest is required"
            }
        }
}

/**
* Inputs bound into the canonical authorization request.
*
* The Play Integrity token is deliberately absent. It remains an opaque value
* for the future server request and is never decoded or trusted on-device.
*/
class CanonicalAuthorizationRequest(
    operationDigest: ByteArray,
    nonce: ByteArray,
    attestationChallenge: ByteArray,
    keyIdentity: String,
    val packageSigningIdentity: PackageSigningIdentity,
    val policy: AuthorizationPolicy,
) {
    private val operationDigestValue = operationDigest.copyOf().also {
        require(it.isNotEmpty()) { "operationDigest must not be empty" }
    }
    private val nonceValue = nonce.copyOf().also {
        require(it.isNotEmpty()) { "nonce must not be empty" }
    }
    private val attestationChallengeValue = attestationChallenge.copyOf().also {
        require(it.isNotEmpty()) { "attestationChallenge must not be empty" }
    }

    val keyIdentity: String = keyIdentity.trim().also {
        require(it.isNotEmpty()) { "keyIdentity must not be blank" }
    }

    val operationDigest: ByteArray
        get() = operationDigestValue.copyOf()

    val nonce: ByteArray
        get() = nonceValue.copyOf()

    val attestationChallenge: ByteArray
        get() = attestationChallengeValue.copyOf()
}

/**
* Deterministic, length-prefixed request binding for a future Play Integrity
* Standard request.
*
* The format is intentionally not JSON: fixed field order, explicit lengths,
* and a versioned domain separator prevent ambiguous concatenation. The
* resulting bytes and SHA-256 hash are transport-safe and contain no secrets
* beyond the caller-provided digests/nonces/challenge.
*/
object AuthorizationRequestCanonicalizer {
    private const val FORMAT = "conxius-authorization-request"
    private const val VERSION = "1"

    fun canonicalize(request: CanonicalAuthorizationRequest): ByteArray {
        val output = ByteArrayOutputStream()
        writeString(output, "format", FORMAT)
        writeString(output, "version", VERSION)
        writeBytes(output, "operationDigest", request.operationDigest)
        writeBytes(output, "nonce", request.nonce)
        writeBytes(output, "attestationChallenge", request.attestationChallenge)
        writeString(output, "keyIdentity", request.keyIdentity)
        writeString(
            output,
            "policy",
            request.policy.wireValue,
        )
        writeString(
            output,
            "packageName",
            request.packageSigningIdentity.packageName,
        )
        request.packageSigningIdentity.signingCertificateSha256.forEach { certificateDigest ->
            writeString(output, "signingCertificateSha256", certificateDigest)
        }
        return output.toByteArray()
    }

    fun requestHash(request: CanonicalAuthorizationRequest): ByteArray =
        CryptoDigest.sha256(canonicalize(request))

    private fun writeString(output: ByteArrayOutputStream, field: String, value: String) {
        writeUtf8(output, field)
        writeUtf8(output, value)
    }

    private fun writeBytes(output: ByteArrayOutputStream, field: String, value: ByteArray) {
        writeUtf8(output, field)
        writeLengthPrefixed(output, value)
    }

    private fun writeUtf8(output: ByteArrayOutputStream, value: String) {
        writeLengthPrefixed(output, value.toByteArray(StandardCharsets.UTF_8))
    }

    private fun writeLengthPrefixed(output: ByteArrayOutputStream, value: ByteArray) {
        require(value.size <= MAX_FIELD_SIZE) { "canonical field is too large" }
        output.write((value.size ushr 24) and 0xff)
        output.write((value.size ushr 16) and 0xff)
        output.write((value.size ushr 8) and 0xff)
        output.write(value.size and 0xff)
        output.write(value)
    }

    private const val MAX_FIELD_SIZE = 1 shl 20
}
