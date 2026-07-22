package com.conxius.wallet.bitcoin

/**
* Versioned BitVM2 quarantine/request envelope shared with TypeScript.
* This data class validates structure only; it is not the final BitVM2
* protocol contract or a proof verifier and must not be treated as evidence.
*/
data class BitVmBlockContext(
    val height: Long,
    val hash: String,
)

data class BitVmProofEnvelope(
    val schemaVersion: String,
    val proof: String,
    val verificationKeyId: String,
    val verificationKeyDigest: String,
    val publicInputs: List<String>,
    val curve: String,
    val circuitId: String,
    val encoding: String,
    val network: String,
    val blockContext: BitVmBlockContext,
    val tapCount: Int,
    val tapIndex: Int,
    val domainSeparation: String,
    val transactionBinding: String,
    val stateBinding: String,
)

data class BitVmVerifiedEvidence(
    val envelope: BitVmProofEnvelope,
    val verifierRevision: String,
    val verifierDigest: String,
)

sealed interface BitVmVerificationOutcome {
    val authoritative: Boolean

    data class Unsupported(val reason: String) : BitVmVerificationOutcome {
        override val authoritative: Boolean = false
    }

    data class Simulated(val reason: String) : BitVmVerificationOutcome {
        override val authoritative: Boolean = false
        val simulated: Boolean = true
    }

    data class Malformed(val reason: String) : BitVmVerificationOutcome {
        override val authoritative: Boolean = false
    }

    data class Invalid(val reason: String) : BitVmVerificationOutcome {
        override val authoritative: Boolean = false
    }

    data class Verified(val evidence: BitVmVerifiedEvidence) : BitVmVerificationOutcome {
        override val authoritative: Boolean = true
    }
}

sealed interface BitVmSegmentGenerationOutcome {
    data class Unsupported(val reason: String) : BitVmSegmentGenerationOutcome
    data class Simulated(val reason: String) : BitVmSegmentGenerationOutcome {
        val simulated: Boolean = true
    }

    data class Malformed(val reason: String) : BitVmSegmentGenerationOutcome
}

sealed interface BitVmDisputeSigningOutcome {
    data class Unsupported(val reason: String) : BitVmDisputeSigningOutcome
    data class Simulated(val reason: String) : BitVmDisputeSigningOutcome {
        val simulated: Boolean = true
    }

    data class Malformed(val reason: String) : BitVmDisputeSigningOutcome
    data class Invalid(val reason: String) : BitVmDisputeSigningOutcome
}

/**
* BitVM2 manager quarantine.
*
* No reviewed verifier or dispute transaction backend is present in this
* module. Every production entrypoint therefore returns a typed
* unsupported outcome in both debug and release builds. Synthetic segments and
* signatures are intentionally not generated.
*/
class BitVmManager {
    companion object {
        const val NUM_TAPS = 364
        const val VALIDATING_TAPS = 1
        const val HASHING_TAPS = 363
        const val QUARANTINE_SCHEMA_VERSION = "conxian.bitvm2.quarantine-envelope.v1"

        private val SUPPORTED_ENCODINGS = setOf("hex", "base64", "base64url")
        private val SUPPORTED_NETWORKS = setOf("mainnet", "testnet", "regtest", "devnet")
        private val BASE64_PATTERN = Regex("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$")
        private val BASE64URL_PATTERN = Regex("^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$")
    }

    /** Raw proof strings are not the quarantine contract and cannot be segmented. */
    fun generateSegments(rawProof: String): BitVmSegmentGenerationOutcome {
        return if (rawProof.isBlank()) {
            BitVmSegmentGenerationOutcome.Malformed("A versioned BitVM2 quarantine envelope is required")
        } else {
            BitVmSegmentGenerationOutcome.Malformed("Raw BitVM2 proofs cannot be segmented without quarantine metadata")
        }
    }

    /** No segment list is returned until a reviewed native backend exists. */
    fun generateSegments(envelope: BitVmProofEnvelope): BitVmSegmentGenerationOutcome {
        return when (val validation = validateEnvelope(envelope)) {
            is ContractValidation.Valid -> BitVmSegmentGenerationOutcome.Unsupported(
                "BitVM2 segment generation is unavailable until a reviewed native backend exists",
            )

            is ContractValidation.Malformed -> BitVmSegmentGenerationOutcome.Malformed(validation.reason)
            is ContractValidation.Unsupported -> BitVmSegmentGenerationOutcome.Unsupported(validation.reason)
        }
    }

    /** A segment cannot be checked without a reviewed verifier. */
    fun verifySegment(tapIndex: Int, segment: String): BitVmVerificationOutcome {
        if (!isValidTapIndex(tapIndex)) {
            return BitVmVerificationOutcome.Malformed("BitVM2 tap index is outside the quarantine envelope tap range")
        }
        if (segment.isBlank()) {
            return BitVmVerificationOutcome.Malformed("BitVM2 segment cannot be empty")
        }
        return BitVmVerificationOutcome.Unsupported(
            "BitVM2 tap verification is unavailable until a reviewed native backend exists",
        )
    }

    fun verifySegment(envelope: BitVmProofEnvelope): BitVmVerificationOutcome {
        return verifyProof(envelope)
    }

    /** Raw proof inputs fail closed because they omit the quarantine envelope. */
    fun verifyProof(rawProof: String): BitVmVerificationOutcome {
        return if (rawProof.isBlank()) {
            BitVmVerificationOutcome.Malformed("A versioned BitVM2 quarantine envelope is required")
        } else {
            BitVmVerificationOutcome.Malformed("Raw BitVM2 proofs cannot be verified without quarantine metadata")
        }
    }

    /** Valid structure still produces unsupported until the real verifier exists. */
    fun verifyProof(envelope: BitVmProofEnvelope): BitVmVerificationOutcome {
        return when (val validation = validateEnvelope(envelope)) {
            is ContractValidation.Valid -> BitVmVerificationOutcome.Unsupported(
                "No reviewed BitVM2 verifier is integrated; quarantine verification is unsupported",
            )

            is ContractValidation.Malformed -> BitVmVerificationOutcome.Malformed(validation.reason)
            is ContractValidation.Unsupported -> BitVmVerificationOutcome.Unsupported(validation.reason)
        }
    }

    /** Legacy shape retained only as a typed, non-signing quarantine path. */
    fun signDispute(tapIndex: Int, commitment: String): BitVmDisputeSigningOutcome {
        if (!isValidTapIndex(tapIndex)) {
            return BitVmDisputeSigningOutcome.Malformed(
                "BitVM2 dispute tap index is outside the quarantine envelope tap range",
            )
        }
        if (commitment.isBlank()) {
            return BitVmDisputeSigningOutcome.Malformed("BitVM2 state commitment is required")
        }
        return BitVmDisputeSigningOutcome.Unsupported(
            "BitVM2 dispute signing requires a quarantine envelope and reviewed verification evidence",
        )
    }

    /**
     * Refuses signing for every non-authoritative outcome and remains
     * unsupported even when a future caller supplies a verified result until a
     * reviewed native signing backend is wired.
     */
    fun signDispute(
        envelope: BitVmProofEnvelope,
        verification: BitVmVerificationOutcome,
    ): BitVmDisputeSigningOutcome {
        when (val validation = validateEnvelope(envelope)) {
            is ContractValidation.Malformed -> return BitVmDisputeSigningOutcome.Malformed(validation.reason)
            is ContractValidation.Unsupported -> return BitVmDisputeSigningOutcome.Unsupported(validation.reason)
            ContractValidation.Valid -> Unit
        }

        if (!isValidTapIndex(envelope.tapIndex)) {
            return BitVmDisputeSigningOutcome.Malformed(
                "BitVM2 dispute tap index is outside the quarantine envelope tap range",
            )
        }

        return when (verification) {
            is BitVmVerificationOutcome.Unsupported -> BitVmDisputeSigningOutcome.Unsupported(
                "Dispute signing requires reviewed BitVM2 verification evidence",
            )

            is BitVmVerificationOutcome.Simulated -> BitVmDisputeSigningOutcome.Simulated(
                "Simulated BitVM2 results are never authoritative for signing",
            )

            is BitVmVerificationOutcome.Malformed -> BitVmDisputeSigningOutcome.Malformed(
                "Malformed BitVM2 verification evidence cannot be signed",
            )

            is BitVmVerificationOutcome.Invalid -> BitVmDisputeSigningOutcome.Invalid(
                "Invalid BitVM2 verification evidence cannot be signed",
            )

            is BitVmVerificationOutcome.Verified -> BitVmDisputeSigningOutcome.Unsupported(
                "BitVM2 native dispute signing is unavailable until the reviewed backend exists",
            )
        }
    }

    private fun isValidTapIndex(tapIndex: Int): Boolean = tapIndex in 0 until NUM_TAPS

    private fun validateEnvelope(envelope: BitVmProofEnvelope): ContractValidation {
        if (envelope.schemaVersion != QUARANTINE_SCHEMA_VERSION) {
            return ContractValidation.Unsupported("The BitVM2 quarantine envelope schema is not enabled")
        }
        if (envelope.proof.isBlank()
            || envelope.verificationKeyId.isBlank()
            || envelope.verificationKeyDigest.isBlank()
            || envelope.curve.isBlank()
            || envelope.circuitId.isBlank()
            || envelope.domainSeparation.isBlank()
            || envelope.transactionBinding.isBlank()
            || envelope.stateBinding.isBlank()
        ) {
            return ContractValidation.Malformed("BitVM2 quarantine envelope is missing required fields")
        }
        if (envelope.publicInputs.isEmpty() || envelope.publicInputs.any { it.isBlank() }) {
            return ContractValidation.Malformed("BitVM2 public inputs must be ordered and non-empty")
        }
        if (envelope.encoding !in SUPPORTED_ENCODINGS) {
            return ContractValidation.Unsupported("The BitVM2 proof encoding is not supported")
        }
        if (!isEncodedProof(envelope.proof, envelope.encoding)) {
            return ContractValidation.Malformed("BitVM2 proof bytes do not match the declared encoding")
        }
        if (envelope.network !in SUPPORTED_NETWORKS
            || envelope.blockContext.height < 0L
            || envelope.blockContext.hash.isBlank()
        ) {
            return ContractValidation.Malformed("BitVM2 network or block context is malformed")
        }
        if (envelope.tapCount != NUM_TAPS || !isValidTapIndex(envelope.tapIndex)) {
            return ContractValidation.Malformed("BitVM2 tap count or index is outside the quarantine envelope range")
        }
        return ContractValidation.Valid
    }

    private fun isEncodedProof(proof: String, encoding: String): Boolean = when (encoding) {
        "hex" -> proof.removePrefix("0x").isNotEmpty()
            && proof.removePrefix("0x").length % 2 == 0
            && proof.removePrefix("0x").all { it in "0123456789abcdefABCDEF" }
        "base64" -> BASE64_PATTERN.matches(proof)
        "base64url" -> BASE64URL_PATTERN.matches(proof)
        else -> false
    }

    private sealed interface ContractValidation {
        data object Valid : ContractValidation
        data class Unsupported(val reason: String) : ContractValidation
        data class Malformed(val reason: String) : ContractValidation
    }
}
