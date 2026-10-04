package com.conxius.wallet.bitcoin

import org.bouncycastle.util.encoders.Hex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * BIP-327 sign/verify conformance from the official `sign_verify_vectors.json`
 * (bitcoin/bips, `bip-0327`). Exercises the full `signPartial` + `partialSigVerify`
 * path that [Musig2Signer] shares with the Capacitor bridge, across signer-index
 * reorderings (which exercise the KeyAgg coefficient logic) and an empty message.
 */
class Musig2SignVerifyTest {
    private val sk = BigInteger("7FB9E0E687ADA1EEBF7ECFE2F21E73EBDB51A7D450948DFE8D76D7F2D1007671", 16)

    private val secnonce = Hex.decode(
        "508B81A611F100A6B2B6B29656590898AF488BCF2E1F55CF22E5CFB84421FE61" +
            "FA27FD49B1D50085B481285E1CA205D55C82CC1B31FF5CD54A489829355901F7" +
            "03935F972DA013F80AE011890FA89B67A27B7BE6CCB24D3274D18B2D4067F261A9",
    )

    private val pubkeys = listOf(
        "03935F972DA013F80AE011890FA89B67A27B7BE6CCB24D3274D18B2D4067F261A9",
        "02F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9",
        "02DFF1D77F2A671C5F36183726DB2341BE58FEAE1DA2DECED843240F7B502BA661",
    ).map { Hex.decode(it) }

    private val pnonces = listOf(
        "0337C87821AFD50A8644D820A8F3E02E499C931865C2360FB43D0A0D20DAFE07EA" +
            "0287BF891D2A6DEAEBADC909352AA9405D1428C15F4B75F04DAE642A95C2548480",
        "0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798" +
            "0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
        "032DE2662628C90B03F5E720284EB52FF7D71F4284F627B68A853D78C78E1FFE93" +
            "03E4C5524E83FFE1493B9077CF1CA6BEB2090C93D930321071AD40B2F44E599046",
    ).map { Hex.decode(it) }

    private val aggnonce = Hex.decode(
        "028465FCF0BBDBCF443AABCCE533D42B4B5A10966AC09A49655E8C42DAAB8FCD61" +
            "037496A3CC86926D452CAFCFD55D25972CA1675D549310DE296BFF42F72EEEA8C9",
    )

    private val msgs = listOf(
        Hex.decode("F95466D086770E689964664219266FE5ED215C92AE20BAB5C9D79ADDDDF3C0CF"),
        ByteArray(0),
        Hex.decode("2626262626262626262626262626262626262626262626262626262626262626"),
    )

    private fun signAndVerify(
        keyIndices: List<Int>,
        nonceIndices: List<Int>,
        msgIndex: Int,
        signerIndex: Int,
        expectedHex: String,
    ) {
        val pubkeys = keyIndices.map { pubkeys[it] }
        val pubnonces = nonceIndices.map { pnonces[it] }
        val msg = msgs[msgIndex]

        val psig = Musig2Signer.signPartial(
            secnonce, Musig2Signer.secretScalar(sk), aggnonce, pubkeys, emptyList(), emptyList(), msg,
        )
        assertEquals(expectedHex, Hex.toHexString(psig).uppercase())
        assertTrue(
            Musig2Signer.partialSigVerify(
                psig, pubnonces[signerIndex], pubnonces, pubkeys, emptyList(), emptyList(), msg, signerIndex,
            ),
        )
    }

    @Test
    fun signVerifyCase0() = signAndVerify(listOf(0, 1, 2), listOf(0, 1, 2), 0, 0, "012ABBCB52B3016AC03AD82395A1A415C48B93DEF78718E62A7A90052FE224FB")

    @Test
    fun signVerifyCase1() = signAndVerify(listOf(1, 0, 2), listOf(1, 0, 2), 0, 1, "9FF2F7AAA856150CC8819254218D3ADEEB0535269051897724F9DB3789513A52")

    @Test
    fun signVerifyCase2() = signAndVerify(listOf(1, 2, 0), listOf(1, 2, 0), 0, 2, "FA23C359F6FAC4E7796BB93BC9F0532A95468C539BA20FF86D7C76ED92227900")

    @Test
    fun signVerifyEmptyMessage() = signAndVerify(listOf(0, 1, 2), listOf(0, 1, 2), 1, 0, "D7D63FFD644CCDA4E62BC2BC0B1D02DD32A1DC3030E155195810231D1037D82D")
}
