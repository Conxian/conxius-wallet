package com.conxius.wallet.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KeySecurityPolicyTest {
    @Test
    fun strongBoxRequiredAcceptsOnlyExplicitStrongBoxEvidence() {
        val decision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.STRONGBOX_REQUIRED,
            evidence = availableEvidence(KeySecurityTier.STRONGBOX),
        )

        assertTrue(decision.accepted)
        assertEquals(AuthorizationDecisionReason.ALLOWED_STRONGBOX, decision.reason)
    }

    @Test
    fun strongBoxRequiredRejectsLegacyHardwareEvidenceWithoutStrongBoxProof() {
        val decision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.STRONGBOX_REQUIRED,
            evidence = availableEvidence(
                tier = KeySecurityTier.TRUSTED_ENVIRONMENT,
                source = KeyInfoEvidenceSource.LEGACY_INSIDE_SECURE_HARDWARE,
            ),
        )

        assertFalse(decision.accepted)
        assertEquals(
            AuthorizationDecisionReason.REJECTED_STRONGBOX_NOT_PROVEN,
            decision.reason,
        )
    }

    @Test
    fun teeAllowedAcceptsTrustedEnvironmentAndStrongBox() {
        val strongBoxDecision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.TEE_ALLOWED,
            evidence = availableEvidence(KeySecurityTier.STRONGBOX),
        )
        val teeDecision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.TEE_ALLOWED,
            evidence = availableEvidence(KeySecurityTier.TRUSTED_ENVIRONMENT),
        )

        assertTrue(strongBoxDecision.accepted)
        assertEquals(AuthorizationDecisionReason.ALLOWED_STRONGBOX, strongBoxDecision.reason)
        assertTrue(teeDecision.accepted)
        assertEquals(
            AuthorizationDecisionReason.ALLOWED_TRUSTED_ENVIRONMENT,
            teeDecision.reason,
        )
    }

    @Test
    fun softwareUnknownAndUnsupportedEvidenceFailClosed() {
        val softwareDecision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.TEE_ALLOWED,
            evidence = availableEvidence(KeySecurityTier.SOFTWARE),
        )
        val unknownDecision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.TEE_ALLOWED,
            evidence = LocalKeyInfoEvidence.Unavailable(
                securityTier = KeySecurityTier.UNKNOWN,
                apiLevel = 31,
                source = KeyInfoEvidenceSource.KEY_INFO_UNAVAILABLE,
                reason = KeyInfoEvidenceReason.KEY_INFO_UNAVAILABLE,
            ),
        )
        val unsupportedDecision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.TEE_ALLOWED,
            evidence = LocalKeyInfoEvidence.Unavailable(
                securityTier = KeySecurityTier.UNSUPPORTED,
                apiLevel = 25,
                source = KeyInfoEvidenceSource.PLATFORM_UNSUPPORTED,
                reason = KeyInfoEvidenceReason.UNSUPPORTED_API,
            ),
        )

        assertFalse(softwareDecision.accepted)
        assertEquals(
            AuthorizationDecisionReason.REJECTED_SOFTWARE_BACKED,
            softwareDecision.reason,
        )
        assertFalse(unknownDecision.accepted)
        assertEquals(
            AuthorizationDecisionReason.REJECTED_KEY_INFO_UNAVAILABLE,
            unknownDecision.reason,
        )
        assertFalse(unsupportedDecision.accepted)
        assertEquals(AuthorizationDecisionReason.REJECTED_UNSUPPORTED, unsupportedDecision.reason)
    }

    @Test
    fun strongBoxRequiredReportsUnavailableStrongBoxSeparately() {
        val decision = AuthorizationPolicyEvaluator.evaluate(
            policy = AuthorizationPolicy.STRONGBOX_REQUIRED,
            evidence = LocalKeyInfoEvidence.Unavailable(
                securityTier = KeySecurityTier.UNSUPPORTED,
                apiLevel = 31,
                source = KeyInfoEvidenceSource.PLATFORM_UNSUPPORTED,
                reason = KeyInfoEvidenceReason.STRONGBOX_UNAVAILABLE,
            ),
        )

        assertFalse(decision.accepted)
        assertEquals(
            AuthorizationDecisionReason.REJECTED_STRONGBOX_UNAVAILABLE,
            decision.reason,
        )
    }

    private fun availableEvidence(
        tier: KeySecurityTier,
        source: KeyInfoEvidenceSource = KeyInfoEvidenceSource.KEY_INFO_SECURITY_LEVEL,
    ): LocalKeyInfoEvidence.Available = LocalKeyInfoEvidence.Available(
        securityTier = tier,
        apiLevel = 31,
        source = source,
        securityLevel = null,
        isInsideSecureHardware = tier == KeySecurityTier.STRONGBOX ||
            tier == KeySecurityTier.TRUSTED_ENVIRONMENT,
        keyAlgorithm = "EC",
        keySize = 256,
        purposes = 4,
        digests = setOf("SHA-256"),
        userAuthenticationRequired = false,
        strongBoxLevelKnown = tier == KeySecurityTier.STRONGBOX,
    )
}
