package com.conxius.wallet.crypto

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import java.io.ByteArrayInputStream
import java.security.AlgorithmParameters
import java.security.GeneralSecurityException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.security.interfaces.ECPublicKey
import java.security.spec.ECFieldFp
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.util.Locale

private const val ANDROID_KEYSTORE_PROVIDER = "AndroidKeyStore"
private const val P256_CURVE = "secp256r1"
private const val MIN_STRONGBOX_API = 28
private const val KEY_ALIAS_MAX_LENGTH = 128

/**
* Stable Android Keystore namespace owned by [KeyMintAuthorizationManager].
*
* Callers must provide aliases in the form
* `ConxiusAuthorizationKey.v1.<caller-supplied-id>`. Other Keystore aliases,
* including the wallet's seed/database aliases, are outside this API.
*/
const val AUTHORIZATION_KEY_ALIAS_PREFIX = "ConxiusAuthorizationKey.v1."

/** How an authorization key was provisioned for this request. */
enum class AuthorizationKeyProvisioningPath {
    STRONGBOX_REQUESTED,
    TRUSTED_ENVIRONMENT_REQUESTED,
    TRUSTED_ENVIRONMENT_FALLBACK,
    EXISTING_KEY,
}

/** Explicit reason for a TEE fallback under [AuthorizationPolicy.TEE_ALLOWED]. */
enum class AuthorizationKeyFallbackReason(val code: String) {
    STRONGBOX_UNAVAILABLE("strongbox_unavailable"),
}

/** Stable reasons for rejecting a key that cannot prove the authorization profile. */
enum class AuthorizationKeyProfileReason(val code: String) {
    KEYSTORE_ALIAS_MISMATCH("keystore_alias_mismatch"),
    KEY_MATERIAL_EMPTY("key_material_empty"),
    KEY_ALGORITHM_MISMATCH("key_algorithm_mismatch"),
    KEY_SIZE_MISMATCH("key_size_mismatch"),
    KEY_PURPOSES_MISMATCH("key_purposes_mismatch"),
    KEY_DIGESTS_MISMATCH("key_digests_mismatch"),
    CERTIFICATE_CHAIN_INVALID("certificate_chain_invalid"),
    CERTIFICATE_PUBLIC_KEY_MISMATCH("certificate_public_key_mismatch"),
    EC_CURVE_MISMATCH("ec_curve_mismatch"),
}

/**
* Request to create a dedicated P-256 authorization key.
*
* [alias] must use [AUTHORIZATION_KEY_ALIAS_PREFIX]. The challenge is copied
* at the boundary, must be 1–128 bytes, and is only used as an Android KeyMint
* attestation challenge. The private key never leaves Android Keystore.
*/
class AuthorizationKeyRequest(
    val alias: String,
    val policy: AuthorizationPolicy,
    attestationChallenge: ByteArray,
) {
    private val attestationChallengeValue = attestationChallenge.copyOf().also {
        require(it.isNotEmpty()) { "attestationChallenge must not be empty" }
        require(it.size <= MAX_ATTESTATION_CHALLENGE_BYTES) {
            "attestationChallenge must be at most $MAX_ATTESTATION_CHALLENGE_BYTES bytes"
        }
    }

    val attestationChallenge: ByteArray
        get() = attestationChallengeValue.copyOf()
}

/**
* Public evidence returned after a policy-accepted authorization key exists.
*
* This type contains no PrivateKey, private-key bytes, or signing operation.
* It exposes only the public key, certificate chain, key identity, package
* signing identity, and local KeyInfo evidence needed by a future server-bound
* authorization flow.
*/
class AuthorizationKeyEvidence internal constructor(
    val alias: String,
    val keyIdentity: String,
    publicKeyEncoded: ByteArray,
    certificateChain: List<ByteArray>,
    val localKeyInfo: LocalKeyInfoEvidence,
    val policy: AuthorizationPolicy,
    val policyDecision: AuthorizationPolicyDecision,
    val packageSigningIdentity: PackageSigningIdentity,
    requestedAttestationChallengeHash: ByteArray?,
    val provisioningPath: AuthorizationKeyProvisioningPath,
    val fallbackReason: AuthorizationKeyFallbackReason?,
) {
    private val publicKeyEncodedValue = publicKeyEncoded.copyOf()
    private val certificateChainValue = certificateChain.map { it.copyOf() }
    private val requestedAttestationChallengeHashValue = requestedAttestationChallengeHash?.copyOf()

    init {
        require(policyDecision.accepted) {
            "only policy-accepted evidence can be exposed"
        }
        require(publicKeyEncodedValue.isNotEmpty()) {
            "public key evidence must not be empty"
        }
        require(certificateChainValue.isNotEmpty()) {
            "certificate-chain evidence must not be empty"
        }
        require(fallbackReason == null || provisioningPath ==
            AuthorizationKeyProvisioningPath.TRUSTED_ENVIRONMENT_FALLBACK
        ) {
            "fallback reason is only valid for an explicit fallback path"
        }
    }

    val publicKeyEncoded: ByteArray
        get() = publicKeyEncodedValue.copyOf()

    val certificateChain: List<ByteArray>
        get() = certificateChainValue.map { it.copyOf() }

    /** SHA-256 of the challenge requested during creation; null for inspection-only evidence. */
    val requestedAttestationChallengeHash: ByteArray?
        get() = requestedAttestationChallengeHashValue?.copyOf()
}

/** Fail-closed errors from the KeyMint authorization boundary. */
sealed class KeyMintAuthorizationException(
    message: String,
    cause: Throwable? = null,
) : IllegalStateException(message, cause) {
    class InvalidAlias(alias: String) : KeyMintAuthorizationException(
        "invalid authorization key alias: $alias",
    )

    class KeyAlreadyExists(alias: String) : KeyMintAuthorizationException(
        "authorization key alias already exists: $alias",
    )

    class GenerationFailed(
        alias: String,
        policy: AuthorizationPolicy,
        cause: Throwable,
    ) : KeyMintAuthorizationException(
        "authorization key generation failed for policy ${policy.wireValue} and alias $alias",
        cause,
    )

    class KeyNotFound(alias: String, cause: Throwable? = null) : KeyMintAuthorizationException(
        "authorization key not found: $alias",
        cause,
    )

    class EvidenceUnavailable(alias: String, cause: Throwable? = null) : KeyMintAuthorizationException(
        "authorization key evidence unavailable: $alias",
        cause,
    )

    class KeyProfileRejected(
        val reason: AuthorizationKeyProfileReason,
        alias: String,
        cause: Throwable? = null,
    ) : KeyMintAuthorizationException(
        "authorization key profile rejected by ${reason.code} for alias $alias",
        cause,
    )

    class PackageIdentityUnavailable(cause: Throwable) : KeyMintAuthorizationException(
        "package signing identity unavailable",
        cause,
    )

    class PolicyRejected(
        val decision: AuthorizationPolicyDecision,
        alias: String,
    ) : KeyMintAuthorizationException(
        "authorization key rejected by policy ${decision.reason.code} for alias $alias",
    )
}

/**
* Internal key-store output; it intentionally carries no private key handle.
* The adapter must echo the inspected Keystore alias so the manager can bind
* evidence to the namespace-validated request.
*/
internal data class StoredAuthorizationKey(
    val publicKeyEncoded: ByteArray,
    val certificateChain: List<ByteArray>,
    val localKeyInfo: LocalKeyInfoEvidence,
    val keystoreAlias: String? = null,
)

/** Android KeyMint adapter, injectable in JVM tests without hardware. */
internal interface AuthorizationKeyStore {
    fun containsAlias(alias: String): Boolean

    fun create(
        alias: String,
        attestationChallenge: ByteArray,
        requestStrongBox: Boolean,
    ): StoredAuthorizationKey

    fun inspect(alias: String): StoredAuthorizationKey

    fun delete(alias: String)
}

/**
* Creates and inspects non-exportable P-256/ECDSA authorization keys.
*
* This manager is deliberately separate from [StrongBoxManager], which owns
* existing AES seed/database storage, and from protocol signing managers such
* as secp256k1/Schnorr implementations. It is not wired into wallet unlock or
* Bitcoin/Stacks signing in this slice.
*/
class KeyMintAuthorizationManager private constructor(
    private val keyStore: AuthorizationKeyStore,
    private val packageSigningIdentity: PackageSigningIdentity,
    private val strongBoxSupported: Boolean,
    private val apiLevel: Int,
    @Suppress("UNUSED_PARAMETER") constructorMarker: Unit,
) {
    constructor(context: Context) : this(
        keyStore = AndroidAuthorizationKeyStore(),
        packageSigningIdentity = try {
            AndroidPackageSigningIdentity.from(context.applicationContext)
        } catch (error: Exception) {
            throw KeyMintAuthorizationException.PackageIdentityUnavailable(error)
        },
        strongBoxSupported = AndroidStrongBoxCapability.isSupported(context.applicationContext),
        apiLevel = Build.VERSION.SDK_INT,
        constructorMarker = Unit,
    )

    internal constructor(
        keyStore: AuthorizationKeyStore,
        packageSigningIdentity: PackageSigningIdentity,
        strongBoxSupported: Boolean,
        apiLevel: Int,
    ) : this(keyStore, packageSigningIdentity, strongBoxSupported, apiLevel, Unit)

    /**
     * Creates a new authorization key and returns policy-accepted public
     * evidence. A StrongBox-required request never falls back to TEE.
     */
    fun createAuthorizationKey(request: AuthorizationKeyRequest): AuthorizationKeyEvidence {
        validateAlias(request.alias)
        if (keyStore.containsAlias(request.alias)) {
            throw KeyMintAuthorizationException.KeyAlreadyExists(request.alias)
        }

        val shouldRequestStrongBox = shouldRequestStrongBox(request.policy, request.alias)
        var provisioningPath = if (shouldRequestStrongBox) {
            AuthorizationKeyProvisioningPath.STRONGBOX_REQUESTED
        } else {
            AuthorizationKeyProvisioningPath.TRUSTED_ENVIRONMENT_REQUESTED
        }
        var fallbackReason: AuthorizationKeyFallbackReason? = null

        val storedKey = try {
            keyStore.create(
                alias = request.alias,
                attestationChallenge = request.attestationChallenge,
                requestStrongBox = shouldRequestStrongBox,
            )
        } catch (error: Exception) {
            if (!shouldRequestStrongBox ||
                request.policy != AuthorizationPolicy.TEE_ALLOWED ||
                !isExplicitStrongBoxUnavailable(error)
            ) {
                deleteQuietly(request.alias)
                throw KeyMintAuthorizationException.GenerationFailed(
                    alias = request.alias,
                    policy = request.policy,
                    cause = error,
                )
            }

            // TEE_ALLOWED makes the downgrade explicit, but only an Android
            // StrongBoxUnavailableException is an allowed downgrade signal.
            deleteQuietly(request.alias)
            provisioningPath = AuthorizationKeyProvisioningPath.TRUSTED_ENVIRONMENT_FALLBACK
            fallbackReason = AuthorizationKeyFallbackReason.STRONGBOX_UNAVAILABLE
            try {
                keyStore.create(
                    alias = request.alias,
                    attestationChallenge = request.attestationChallenge,
                    requestStrongBox = false,
                )
            } catch (fallbackError: Exception) {
                throw KeyMintAuthorizationException.GenerationFailed(
                    alias = request.alias,
                    policy = request.policy,
                    cause = fallbackError,
                )
            }
        }

        return exposeAcceptedEvidence(
            alias = request.alias,
            policy = request.policy,
            storedKey = storedKey,
            requestedAttestationChallengeHash = CryptoDigest.sha256(request.attestationChallenge),
            provisioningPath = provisioningPath,
            fallbackReason = fallbackReason,
            deleteOnFailure = true,
        )
    }

    /** Inspects an existing key without returning or exporting its private material. */
    fun inspectAuthorizationKey(
        alias: String,
        policy: AuthorizationPolicy,
    ): AuthorizationKeyEvidence {
        validateAlias(alias)
        val storedKey = try {
            keyStore.inspect(alias)
        } catch (error: KeyMintAuthorizationException) {
            throw error
        } catch (error: Exception) {
            throw KeyMintAuthorizationException.KeyNotFound(alias, error)
        }

        return exposeAcceptedEvidence(
            alias = alias,
            policy = policy,
            storedKey = storedKey,
            requestedAttestationChallengeHash = null,
            provisioningPath = AuthorizationKeyProvisioningPath.EXISTING_KEY,
            fallbackReason = null,
            deleteOnFailure = false,
        )
    }

    @SuppressLint("NewApi")
    private fun isExplicitStrongBoxUnavailable(error: Throwable): Boolean =
        apiLevel >= MIN_STRONGBOX_API && error is StrongBoxUnavailableException

    private fun shouldRequestStrongBox(policy: AuthorizationPolicy, alias: String): Boolean {
        return when (policy) {
            AuthorizationPolicy.STRONGBOX_REQUIRED -> {
                if (apiLevel < MIN_STRONGBOX_API || !strongBoxSupported) {
                    val reason = if (apiLevel < MIN_STRONGBOX_API) {
                        KeyInfoEvidenceReason.UNSUPPORTED_API
                    } else {
                        KeyInfoEvidenceReason.STRONGBOX_UNAVAILABLE
                    }
                    throw KeyMintAuthorizationException.PolicyRejected(
                        decision = AuthorizationPolicyEvaluator.evaluate(
                            policy = policy,
                            evidence = LocalKeyInfoEvidence.Unavailable(
                                securityTier = KeySecurityTier.UNSUPPORTED,
                                apiLevel = apiLevel,
                                source = KeyInfoEvidenceSource.PLATFORM_UNSUPPORTED,
                                reason = reason,
                            ),
                        ),
                        alias = alias,
                    )
                }
                true
            }

            AuthorizationPolicy.TEE_ALLOWED ->
                apiLevel >= MIN_STRONGBOX_API && strongBoxSupported
        }
    }

    private fun exposeAcceptedEvidence(
        alias: String,
        policy: AuthorizationPolicy,
        storedKey: StoredAuthorizationKey,
        requestedAttestationChallengeHash: ByteArray?,
        provisioningPath: AuthorizationKeyProvisioningPath,
        fallbackReason: AuthorizationKeyFallbackReason?,
        deleteOnFailure: Boolean,
    ): AuthorizationKeyEvidence {
        try {
            AuthorizationKeyProfileValidator.validate(alias, storedKey)
        } catch (error: KeyMintAuthorizationException.KeyProfileRejected) {
            if (deleteOnFailure) {
                deleteQuietly(alias)
            }
            throw error
        }

        val decision = AuthorizationPolicyEvaluator.evaluate(policy, storedKey.localKeyInfo)
        if (!decision.accepted) {
            if (deleteOnFailure) {
                deleteQuietly(alias)
            }
            throw KeyMintAuthorizationException.PolicyRejected(decision, alias)
        }

        if (storedKey.publicKeyEncoded.isEmpty() || storedKey.certificateChain.isEmpty()) {
            if (deleteOnFailure) {
                deleteQuietly(alias)
            }
            throw KeyMintAuthorizationException.EvidenceUnavailable(alias)
        }

        return AuthorizationKeyEvidence(
            alias = alias,
            keyIdentity = "sha256:${CryptoDigest.sha256Hex(storedKey.publicKeyEncoded)}",
            publicKeyEncoded = storedKey.publicKeyEncoded,
            certificateChain = storedKey.certificateChain,
            localKeyInfo = storedKey.localKeyInfo,
            policy = policy,
            policyDecision = decision,
            packageSigningIdentity = packageSigningIdentity,
            requestedAttestationChallengeHash = requestedAttestationChallengeHash,
            provisioningPath = provisioningPath,
            fallbackReason = fallbackReason,
        )
    }

    private fun deleteQuietly(alias: String) {
        runCatching { keyStore.delete(alias) }
    }

    private fun validateAlias(alias: String) {
        val suffix = alias.removePrefix(AUTHORIZATION_KEY_ALIAS_PREFIX)
        if (alias.isBlank() || alias.length > KEY_ALIAS_MAX_LENGTH ||
            !alias.startsWith(AUTHORIZATION_KEY_ALIAS_PREFIX) || suffix.isBlank() ||
            suffix.any { !(it.isAsciiLetterOrDigit() || it == '.' || it == '_' || it == '-') }
        ) {
            throw KeyMintAuthorizationException.InvalidAlias(alias)
        }
    }
}

private fun Char.isAsciiLetterOrDigit(): Boolean =
    this in 'a'..'z' || this in 'A'..'Z' || this in '0'..'9'

/**
* Validates the exact key profile requested by this manager before any local
* security-tier policy decision can expose authorization evidence.
*/
private object AuthorizationKeyProfileValidator {
    private val expectedDigests = setOf(KeyProperties.DIGEST_SHA256)

    fun validate(alias: String, storedKey: StoredAuthorizationKey) {
        if (storedKey.keystoreAlias != alias) {
            reject(alias, AuthorizationKeyProfileReason.KEYSTORE_ALIAS_MISMATCH)
        }

        val localKeyInfo = storedKey.localKeyInfo as? LocalKeyInfoEvidence.Available
            ?: return

        if (storedKey.publicKeyEncoded.isEmpty() || storedKey.certificateChain.isEmpty()) {
            reject(alias, AuthorizationKeyProfileReason.KEY_MATERIAL_EMPTY)
        }
        if (localKeyInfo.keyAlgorithm != KeyProperties.KEY_ALGORITHM_EC) {
            reject(alias, AuthorizationKeyProfileReason.KEY_ALGORITHM_MISMATCH)
        }
        if (localKeyInfo.keySize != 256) {
            reject(alias, AuthorizationKeyProfileReason.KEY_SIZE_MISMATCH)
        }
        if (localKeyInfo.purposes != KeyProperties.PURPOSE_SIGN) {
            reject(alias, AuthorizationKeyProfileReason.KEY_PURPOSES_MISMATCH)
        }
        if (localKeyInfo.digests != expectedDigests) {
            reject(alias, AuthorizationKeyProfileReason.KEY_DIGESTS_MISMATCH)
        }

        val certificates = try {
            val certificateFactory = CertificateFactory.getInstance("X.509")
            storedKey.certificateChain.map { encodedCertificate ->
                certificateFactory.generateCertificate(
                    ByteArrayInputStream(encodedCertificate),
                ) as? X509Certificate
                    ?: throw GeneralSecurityException("certificate is not X.509")
            }
        } catch (error: Exception) {
            reject(
                alias = alias,
                reason = AuthorizationKeyProfileReason.CERTIFICATE_CHAIN_INVALID,
                cause = error,
            )
        }

        val leafPublicKey = certificates.first().publicKey
        if (!leafPublicKey.encoded.contentEquals(storedKey.publicKeyEncoded)) {
            reject(alias, AuthorizationKeyProfileReason.CERTIFICATE_PUBLIC_KEY_MISMATCH)
        }

        val ecPublicKey = leafPublicKey as? ECPublicKey
            ?: reject(alias, AuthorizationKeyProfileReason.KEY_ALGORITHM_MISMATCH)
        val expectedParameters = try {
            AlgorithmParameters.getInstance("EC").apply {
                init(ECGenParameterSpec(P256_CURVE))
            }.getParameterSpec(ECParameterSpec::class.java)
        } catch (error: Exception) {
            reject(
                alias = alias,
                reason = AuthorizationKeyProfileReason.EC_CURVE_MISMATCH,
                cause = error,
            )
        }

        if (!sameCurve(ecPublicKey.params, expectedParameters)) {
            reject(alias, AuthorizationKeyProfileReason.EC_CURVE_MISMATCH)
        }
    }

    private fun sameCurve(actual: ECParameterSpec, expected: ECParameterSpec): Boolean {
        val actualField = actual.curve.field as? ECFieldFp ?: return false
        val expectedField = expected.curve.field as? ECFieldFp ?: return false
        return actualField.p == expectedField.p &&
            actual.curve.a == expected.curve.a &&
            actual.curve.b == expected.curve.b &&
            actual.generator.affineX == expected.generator.affineX &&
            actual.generator.affineY == expected.generator.affineY &&
            actual.order == expected.order &&
            actual.cofactor == expected.cofactor
    }

    private fun reject(
        alias: String,
        reason: AuthorizationKeyProfileReason,
        cause: Throwable? = null,
    ): Nothing = throw KeyMintAuthorizationException.KeyProfileRejected(
        reason = reason,
        alias = alias,
        cause = cause,
    )
}

private object AndroidStrongBoxCapability {
    fun isSupported(context: Context): Boolean =
        Build.VERSION.SDK_INT >= MIN_STRONGBOX_API &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
}

private object AndroidPackageSigningIdentity {
    fun from(context: Context): PackageSigningIdentity {
        val packageManager = context.packageManager
        val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_SIGNING_CERTIFICATES,
            )
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_SIGNATURES,
            )
        }

        val signatures = packageInfo.signaturesForBinding()
        if (signatures.isEmpty()) {
            throw GeneralSecurityException("package has no signing certificates")
        }

        return PackageSigningIdentity(
            packageName = context.packageName,
            signingCertificateSha256 = signatures.map { signature ->
                CryptoDigest.sha256Hex(signature.toByteArray()).lowercase(Locale.US)
            },
        )
    }

    private fun PackageInfo.signaturesForBinding(): List<Signature> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = signingInfo ?: return emptyList()
            // Bind to the currently signing certificate(s), not historical
            // rotation certificates that are no longer signing this package.
            signingInfo.apkContentsSigners?.toList().orEmpty()
        } else {
            @Suppress("DEPRECATION")
            signatures?.toList().orEmpty()
        }
    }
}

private class AndroidAuthorizationKeyStore : AuthorizationKeyStore {
    override fun containsAlias(alias: String): Boolean = loadKeyStore().containsAlias(alias)

    override fun create(
        alias: String,
        attestationChallenge: ByteArray,
        requestStrongBox: Boolean,
    ): StoredAuthorizationKey {
        val generator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            ANDROID_KEYSTORE_PROVIDER,
        )
        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN,
        )
            .setKeySize(256)
            .setAlgorithmParameterSpec(ECGenParameterSpec(P256_CURVE))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setAttestationChallenge(attestationChallenge.copyOf())

        if (requestStrongBox) {
            check(Build.VERSION.SDK_INT >= MIN_STRONGBOX_API) {
                "StrongBox requires API $MIN_STRONGBOX_API or newer"
            }
            builder.setIsStrongBoxBacked(true)
        }

        generator.initialize(builder.build())
        // The returned KeyPair is deliberately not retained. Android Keystore
        // owns the non-exportable private key after generation.
        generator.generateKeyPair()
        return inspect(alias)
    }

    override fun inspect(alias: String): StoredAuthorizationKey {
        val keyStore = loadKeyStore()
        val privateKey = keyStore.getKey(alias, null) as? PrivateKey
            ?: throw KeyMintAuthorizationException.KeyNotFound(alias)
        val certificateChain = keyStore.getCertificateChain(alias)
            ?.map { certificate -> certificate.encoded }
            .orEmpty()
        val leafCertificate = keyStore.getCertificate(alias)
            ?: throw KeyMintAuthorizationException.EvidenceUnavailable(alias)
        if (certificateChain.isEmpty()) {
            throw KeyMintAuthorizationException.EvidenceUnavailable(alias)
        }

        val keyFactory = KeyFactory.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            ANDROID_KEYSTORE_PROVIDER,
        )
        val keyInfo = keyFactory.getKeySpec(privateKey, KeyInfo::class.java) as KeyInfo

        return StoredAuthorizationKey(
            publicKeyEncoded = leafCertificate.publicKey.encoded.copyOf(),
            certificateChain = certificateChain.map { it.copyOf() },
            localKeyInfo = keyInfo.toLocalEvidence(),
            keystoreAlias = keyInfo.keystoreAlias,
        )
    }

    override fun delete(alias: String) {
        loadKeyStore().deleteEntry(alias)
    }

    private fun loadKeyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE_PROVIDER).apply {
        load(null)
    }

    private fun KeyInfo.toLocalEvidence(): LocalKeyInfoEvidence.Available {
        val currentApi = Build.VERSION.SDK_INT
        if (currentApi >= Build.VERSION_CODES.S) {
            val tier = when (securityLevel) {
                KeyProperties.SECURITY_LEVEL_STRONGBOX -> KeySecurityTier.STRONGBOX
                KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT ->
                    KeySecurityTier.TRUSTED_ENVIRONMENT
                KeyProperties.SECURITY_LEVEL_SOFTWARE -> KeySecurityTier.SOFTWARE
                // This includes SECURITY_LEVEL_UNKNOWN_SECURE. It may be
                // stronger than TEE, but it does not prove the exact tier
                // required by this boundary and must remain fail-closed.
                else -> KeySecurityTier.UNKNOWN
            }
            return LocalKeyInfoEvidence.Available(
                securityTier = tier,
                apiLevel = currentApi,
                source = KeyInfoEvidenceSource.KEY_INFO_SECURITY_LEVEL,
                securityLevel = securityLevel,
                isInsideSecureHardware = isInsideSecureHardware,
                keyAlgorithm = KeyProperties.KEY_ALGORITHM_EC,
                keySize = keySize,
                purposes = purposes,
                digests = digests.toSet(),
                userAuthenticationRequired = isUserAuthenticationRequired,
                strongBoxLevelKnown = true,
            )
        }

        // API 26-30 expose only isInsideSecureHardware. It is enough to
        // establish a trusted hardware environment for TEE_ALLOWED, but it
        // must never be promoted to STRONGBOX.
        return LocalKeyInfoEvidence.Available(
            securityTier = if (isInsideSecureHardware) {
                KeySecurityTier.TRUSTED_ENVIRONMENT
            } else {
                KeySecurityTier.SOFTWARE
            },
            apiLevel = currentApi,
            source = KeyInfoEvidenceSource.LEGACY_INSIDE_SECURE_HARDWARE,
            securityLevel = null,
            isInsideSecureHardware = isInsideSecureHardware,
            keyAlgorithm = KeyProperties.KEY_ALGORITHM_EC,
            keySize = keySize,
            purposes = purposes,
            digests = digests.toSet(),
            userAuthenticationRequired = isUserAuthenticationRequired,
            strongBoxLevelKnown = false,
        )
    }
}
