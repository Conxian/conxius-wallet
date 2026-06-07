package com.conxius.wallet

/**
 * Play Integrity Plugin
 *
 * Current state:
 * - debug builds may use a simulated token for local integration work
 * - release builds must fail closed until a real Play Integrity request and
 *   server-side verification path are wired end-to-end
 */
class PlayIntegrityPlugin {

    /**
     * Requests an integrity token for server-side verification.
     *
     * Debug builds return a simulated token for local development only.
     * Release builds fail closed so the app cannot silently present a stub as
     * production-grade attestation.
     */
    fun requestIntegrityToken(nonce: String): String {
        return if (BuildConfig.DEBUG) {
            "play_integrity_token_debug_stub"
        } else {
            throw UnsupportedOperationException(
                "Play Integrity production enforcement is not enabled in this build"
            )
        }
    }
}
