package com.conxius.wallet.crypto

/**
* Security tiers that can be established from local Android Keystore evidence.
*
* [STRONGBOX] is only reported when Android exposes the explicit StrongBox
* security level (API 31+). On older APIs, isInsideSecureHardware cannot
* distinguish StrongBox from another trusted hardware environment and is
* therefore mapped to [TRUSTED_ENVIRONMENT].
*/
enum class KeySecurityTier {
    STRONGBOX,
    TRUSTED_ENVIRONMENT,
    SOFTWARE,
    UNKNOWN,
    UNSUPPORTED,
}

/** Policies for the dedicated authorization key, independent of AES storage keys. */
enum class AuthorizationPolicy(val wireValue: String) {
    STRONGBOX_REQUIRED("strongbox-required"),
    TEE_ALLOWED("tee-allowed"),
}

/** The source used to classify local KeyInfo evidence. */
enum class KeyInfoEvidenceSource {
    KEY_INFO_SECURITY_LEVEL,
    LEGACY_INSIDE_SECURE_HARDWARE,
    KEY_INFO_UNAVAILABLE,
    PLATFORM_UNSUPPORTED,
}

/** Stable reason codes for unavailable local KeyInfo evidence. */
enum class KeyInfoEvidenceReason(val code: String) {
    KEY_INFO_UNAVAILABLE("key_info_unavailable"),
    UNSUPPORTED_API("unsupported_api"),
    STRONGBOX_UNAVAILABLE("strongbox_unavailable"),
}

/**
* Local evidence captured from Android KeyInfo.
*
* The sealed type intentionally has an internal constructor. Callers cannot
* manufacture a verified StrongBox/TEE result from a debug stub or a web
* fallback; only the Android KeyMint boundary creates [Available] evidence.
*/
sealed class LocalKeyInfoEvidence private constructor(
    open val securityTier: KeySecurityTier,
    open val apiLevel: Int,
    open val source: KeyInfoEvidenceSource,
) {
    class Available internal constructor(
        override val securityTier: KeySecurityTier,
        override val apiLevel: Int,
        override val source: KeyInfoEvidenceSource,
        val securityLevel: Int?,
        val isInsideSecureHardware: Boolean,
        val keyAlgorithm: String,
        val keySize: Int,
        val purposes: Int,
        val digests: Set<String>,
        val userAuthenticationRequired: Boolean,
        val strongBoxLevelKnown: Boolean,
    ) : LocalKeyInfoEvidence(securityTier, apiLevel, source)

    class Unavailable internal constructor(
        override val securityTier: KeySecurityTier,
        override val apiLevel: Int,
        override val source: KeyInfoEvidenceSource,
        val reason: KeyInfoEvidenceReason,
    ) : LocalKeyInfoEvidence(securityTier, apiLevel, source)
}

/** Stable reason codes for the fail-closed authorization policy evaluator. */
enum class AuthorizationDecisionReason(val code: String) {
    ALLOWED_STRONGBOX("allowed_strongbox"),
    ALLOWED_TRUSTED_ENVIRONMENT("allowed_trusted_environment"),
    REJECTED_STRONGBOX_NOT_PROVEN("strongbox_required_but_not_proven"),
    REJECTED_SOFTWARE_BACKED("software_backed_not_allowed"),
    REJECTED_UNKNOWN_EVIDENCE("unknown_security_evidence"),
    REJECTED_UNSUPPORTED("unsupported_security_tier"),
    REJECTED_STRONGBOX_UNAVAILABLE("strongbox_unavailable"),
    REJECTED_KEY_INFO_UNAVAILABLE("key_info_unavailable"),
}

/** A policy decision that must be checked before evidence is used by production code. */
data class AuthorizationPolicyDecision(
    val accepted: Boolean,
    val policy: AuthorizationPolicy,
    val securityTier: KeySecurityTier,
    val reason: AuthorizationDecisionReason,
)

/**
* Fail-closed policy evaluation for authorization-key evidence.
*
* Software, unknown, unavailable, and unsupported evidence is never accepted.
* Platform values such as SECURITY_LEVEL_UNKNOWN_SECURE remain
* [KeySecurityTier.UNKNOWN] until this boundary defines an explicit policy for
* them; they are never silently promoted to StrongBox or TEE evidence.
* StrongBox is accepted for both policies because it is stronger than the
* minimum required by [TEE_ALLOWED].
*/
object AuthorizationPolicyEvaluator {
    fun evaluate(
        policy: AuthorizationPolicy,
        evidence: LocalKeyInfoEvidence,
    ): AuthorizationPolicyDecision {
        return when (evidence.securityTier) {
            KeySecurityTier.STRONGBOX -> AuthorizationPolicyDecision(
                accepted = true,
                policy = policy,
                securityTier = evidence.securityTier,
                reason = AuthorizationDecisionReason.ALLOWED_STRONGBOX,
            )

            KeySecurityTier.TRUSTED_ENVIRONMENT -> {
                if (policy == AuthorizationPolicy.TEE_ALLOWED) {
                    AuthorizationPolicyDecision(
                        accepted = true,
                        policy = policy,
                        securityTier = evidence.securityTier,
                        reason = AuthorizationDecisionReason.ALLOWED_TRUSTED_ENVIRONMENT,
                    )
                } else {
                    AuthorizationPolicyDecision(
                        accepted = false,
                        policy = policy,
                        securityTier = evidence.securityTier,
                        reason = AuthorizationDecisionReason.REJECTED_STRONGBOX_NOT_PROVEN,
                    )
                }
            }

            KeySecurityTier.SOFTWARE -> AuthorizationPolicyDecision(
                accepted = false,
                policy = policy,
                securityTier = evidence.securityTier,
                reason = AuthorizationDecisionReason.REJECTED_SOFTWARE_BACKED,
            )

            KeySecurityTier.UNKNOWN -> AuthorizationPolicyDecision(
                accepted = false,
                policy = policy,
                securityTier = evidence.securityTier,
                reason = if (evidence is LocalKeyInfoEvidence.Unavailable &&
                    evidence.reason == KeyInfoEvidenceReason.KEY_INFO_UNAVAILABLE
                ) {
                    AuthorizationDecisionReason.REJECTED_KEY_INFO_UNAVAILABLE
                } else {
                    AuthorizationDecisionReason.REJECTED_UNKNOWN_EVIDENCE
                },
            )

            KeySecurityTier.UNSUPPORTED -> AuthorizationPolicyDecision(
                accepted = false,
                policy = policy,
                securityTier = evidence.securityTier,
                reason = if (
                    policy == AuthorizationPolicy.STRONGBOX_REQUIRED &&
                    evidence is LocalKeyInfoEvidence.Unavailable &&
                    evidence.reason == KeyInfoEvidenceReason.STRONGBOX_UNAVAILABLE
                ) {
                    AuthorizationDecisionReason.REJECTED_STRONGBOX_UNAVAILABLE
                } else {
                    AuthorizationDecisionReason.REJECTED_UNSUPPORTED
                },
            )
        }
    }
}
