package com.conxius.wallet.bitcoin

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BitVmManagerTest {
    private val manager = BitVmManager()

    private val quarantineEnvelope = BitVmProofEnvelope(
        schemaVersion = BitVmManager.QUARANTINE_SCHEMA_VERSION,
        proof = "deadbeef",
        verificationKeyId = "bitvm2-research-key",
        verificationKeyDigest = "0".repeat(64),
        publicInputs = listOf("input-0", "input-1"),
        curve = "bn254",
        circuitId = "bitvm2-research-circuit",
        encoding = "hex",
        network = "mainnet",
        blockContext = BitVmBlockContext(
            height = 840000L,
            hash = "block-hash-binding",
        ),
        tapCount = BitVmManager.NUM_TAPS,
        tapIndex = 0,
        domainSeparation = "conxian.bitvm2.dispute.v1",
        transactionBinding = "transaction-binding",
        stateBinding = "state-binding",
    )

    @Test
    fun arbitraryProofIsMalformed() {
        val result = manager.verifyProof("arbitrary proof")

        assertTrue(result is BitVmVerificationOutcome.Malformed)
    }

    @Test
    fun malformedContractIsRejectedBeforeVerification() {
        val result = manager.verifyProof(quarantineEnvelope.copy(proof = ""))

        assertTrue(result is BitVmVerificationOutcome.Malformed)
    }

    @Test
    fun malformedProofEncodingIsRejectedBeforeVerification() {
        val result = manager.verifyProof(quarantineEnvelope.copy(proof = "not-hex"))

        assertTrue(result is BitVmVerificationOutcome.Malformed)
    }

    @Test
    fun structurallyValidContractIsUnsupportedInDebugEquivalentUse() {
        val result = manager.verifyProof(quarantineEnvelope)

        assertTrue(result is BitVmVerificationOutcome.Unsupported)
        assertFalse(result.authoritative)
    }

    @Test
    fun invalidTapIndexIsRejectedBeforeSigning() {
        val invalidEnvelope = quarantineEnvelope.copy(tapIndex = BitVmManager.NUM_TAPS)
        val verification = manager.verifyProof(invalidEnvelope)
        val signing = manager.signDispute(
            invalidEnvelope,
            BitVmVerificationOutcome.Unsupported("unavailable"),
        )

        assertTrue(verification is BitVmVerificationOutcome.Malformed)
        assertTrue(signing is BitVmDisputeSigningOutcome.Malformed)
    }

    @Test
    fun noSyntheticSignatureIsReturned() {
        val result = manager.signDispute(
            quarantineEnvelope,
            BitVmVerificationOutcome.Unsupported("unavailable"),
        )

        assertTrue(result is BitVmDisputeSigningOutcome.Unsupported)
    }

    @Test
    fun simulationOutcomeIsExplicitlyNonAuthoritative() {
        val result = BitVmVerificationOutcome.Simulated("evaluation-only")

        assertTrue(result.simulated)
        assertFalse(result.authoritative)
        assertTrue(manager.signDispute(quarantineEnvelope, result) is BitVmDisputeSigningOutcome.Simulated)
    }

    @Test
    fun rawSegmentGenerationDoesNotReturnSyntheticSegments() {
        val result = manager.generateSegments("arbitrary proof")

        assertTrue(result is BitVmSegmentGenerationOutcome.Malformed)
        assertFalse(result is BitVmSegmentGenerationOutcome.Simulated)
    }
}
