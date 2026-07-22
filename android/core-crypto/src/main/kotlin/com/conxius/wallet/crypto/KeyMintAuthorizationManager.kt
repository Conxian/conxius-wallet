package com.conxius.wallet.crypto

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.GeneralSecurityException
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.cert.Certificate
import java.security.spec.ECGenParameterSpec
import java.util.Locale

private const val ANDROID_KEYSTORE_PROVIDER = "AndroidKeyStore"
private const val P256_CURVE = "secp256r1"
private const val MIN_STRONGBOX_API = 28
private const val KEY_ALIAS_MAX_LENGTH = 128

/** How an authorization key was provisioned for this request. */
enum class AuthorizationKeyProvisioningPath {
    STRONGBOX_REQUESTED,
    TRUSTED_ENVIRONMENT_REQUESTED,
    TRUSTED_ENVIRONMENT_FALLBACK,
    EXISTING_KEY,
}

/** Explicit reason for a TEE fallback under [AuthorizationPolicy.TEE_ALLOWED]. */
enum class AuthorizationKeyFallbackReason(val code: String) {
    STRONGBOX_GENERATION_FAILED("strongbox_generation_failed"),
}

/**
* Request to create a dedicated P-256 authorization key.
*
* The challenge is copied at the boundary and is only used as an Android
* KeyMint attestation challenge. The private key never leaves Android Keystore.
*/
class AuthorizationKeyRequest(
    val alias: String,
    val policy: AuthorizationPolicy,
    attestationChallenge: ByteArray,
) {
    private val attestationChallengeValue = attestationChallenge.copyOf().also {
        require(it.isNotEmpty()) { "attestationChallenge must not be empty" }
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

/** Internal key-store output; it intentionally carries no private key handle. */
internal data class StoredAuthorizationKey(
    val publicKeyEncoded: ByteArray,
    val certificateChain: List<ByteArray>,
    val localKeyInfo: LocalKeyInfoEvidence,
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
            if (!shouldRequestStrongBox || request.policy == AuthorizationPolicy.STRONGBOX_REQUIRED) {
                deleteQuietly(request.alias)
                throw KeyMintAuthorizationException.GenerationFailed(
                    alias = request.alias,
                    policy = request.policy,
                    cause = error,
                )
            }

            // TEE_ALLOWED makes the downgrade explicit in the returned path;
            // it is never hidden behind a generic "best effort" result.
            deleteQuietly(request.alias)
            provisioningPath = AuthorizationKeyProvisioningPath.TRUSTED_ENVIRONMENT_FALLBACK
            fallbackReason = AuthorizationKeyFallbackReason.STRONGBOX_GENERATION_FAILED
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
        )
    }

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
    ): AuthorizationKeyEvidence {
        val decision = AuthorizationPolicyEvaluator.evaluate(policy, storedKey.localKeyInfo)
        if (!decision.accepted) {
            deleteQuietly(alias)
            throw KeyMintAuthorizationException.PolicyRejected(decision, alias)
        }

        if (storedKey.publicKeyEncoded.isEmpty() || storedKey.certificateChain.isEmpty()) {
            deleteQuietly(alias)
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
        if (alias.isBlank() || alias.length > KEY_ALIAS_MAX_LENGTH ||
            alias.any { !(it.isLetterOrDigit() || it == '.' || it == '_' || it == '-') }
        ) {
            throw KeyMintAuthorizationException.InvalidAlias(alias)
        }
    }
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
