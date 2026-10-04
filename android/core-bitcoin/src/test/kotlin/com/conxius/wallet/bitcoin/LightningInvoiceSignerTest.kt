package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigInteger

/**
 * BOLT-11 invoice signing.
 *
 * The message-hash vector is the canonical BOLT-11 example invoice
 * (`lnbc1pvjluez...`), whose published SHA256 is asserted literally. The
 * sign/recover round-trip exercises the same RFC-6979 low-S ECDSA + recovery
 * path used by [EvmSigner].
 */
class LightningInvoiceSignerTest {

    @Test
    fun invoiceMessageHashMatchesBolt11CanonicalVector() {
        val invoice = "lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs" +
            "pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2" +
            "ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3" +
            "yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql"
        assertEquals(
            "6daf4d488be41ce7cbb487cab1ef2975e5efcea879b20d421f0ef86b07cbb987",
            Hex.toHexString(LightningInvoiceSigner.invoiceMessageHash(invoice)),
        )
    }

    @Test
    fun signAndRecoverRoundTrip() {
        val privateKey = BigInteger("1111111111111111111111111111111111111111111111111111111111111111", 16)
        val message = Hex.decode("6daf4d488be41ce7cbb487cab1ef2975e5efcea879b20d421f0ef86b07cbb987")

        val signature = LightningInvoiceSigner.signDigest(privateKey, message)
        assertEquals(65, signature.size)

        val recovered = LightningInvoiceSigner.recoverPublicKey(message, signature)
        assertArrayEquals(EvmSigner.uncompressedPublicKey(privateKey), recovered)
    }
}
