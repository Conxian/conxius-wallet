package com.conxius.wallet.bitcoin

import android.util.Log
import java.math.BigInteger

/**
 * Lightning Manager.
 *
 * Thin, stateless facade over [LightningInvoiceSigner] for the BOLT-11 invoice
 * signing primitives: the to-be-signed message hash (Bech32 decode + SHA256) and
 * the compact ECDSA signature over it. Channel management and payment routing
 * (Breez/LDK) remain provider-gated and stay fail-closed below.
 */
class LightningManager {
    private val TAG = "LightningManager"

    /** 32-byte BOLT-11 to-be-signed message hash for [invoice]. */
    fun invoiceMessageHash(invoice: String): ByteArray =
        LightningInvoiceSigner.invoiceMessageHash(invoice)

    /** 65-byte compact ECDSA signature `r || s || recovery-id` over a 32-byte message. */
    fun signInvoiceDigest(privateKey: BigInteger, message: ByteArray): ByteArray =
        LightningInvoiceSigner.signDigest(privateKey, message)

    /** 65-byte uncompressed public key recovered from a BOLT-11 signature. */
    fun recoverInvoicePublicKey(message: ByteArray, signature: ByteArray): ByteArray =
        LightningInvoiceSigner.recoverPublicKey(message, signature)

    /**
     * Full-invoice signing (reconstruct the invoice with a signature field).
     * Fail-closed: requires key custody + invoice reconstruction beyond the
     * native [signInvoiceDigest] primitive.
     */
    fun signInvoice(invoice: String): String {
        Log.d(TAG, "Signing Lightning Invoice")
        return ProductionRuntimeGuard.failClosed(FeatureGate.LIGHTNING,
            "lightning_invoice_sig_enclave_${System.currentTimeMillis()}"
        )
    }

    /**
     * Connects to a remote peer for channel management. Fail-closed: requires
     * Breez/LDK (provider-gated) beyond the native invoice-signing primitive.
     */
    fun connectPeer(peerId: String, host: String, port: Int): Boolean {
        Log.d(TAG, "Connecting to Lightning Peer: $peerId")
        return ProductionRuntimeGuard.failClosed(FeatureGate.LIGHTNING, true)
    }

    /**
     * Estimates the routing fee for a payment.
     */
    fun estimateRoutingFee(amountSats: Long): Long {
        return (amountSats * 0.005).toLong() // 0.5% max
    }
}
