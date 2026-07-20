package com.conxius.wallet.bitcoin

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EsploraBlockSourceTest {
    @Test
    fun parserExtractsAllSupportedEligibleInputTypesAndLittleEndianOutpoints() {
        val txid = "0000000000000000000000000000000000000000000000000000000000000001"
        val inputTxid = "0000000000000000000000000000000000000000000000000000000000000002"
        val compressedKey = "02" + "11".repeat(32)
        val xOnlyKey = "22".repeat(32)
        val p2pkhScriptSig = "46" + "01".repeat(70) + "21" + compressedKey
        val p2shRedeemScript = "0014adfce54f529b2154e3c361bbe3f7d41db0635717"
        val p2shScriptSig = "16" + p2shRedeemScript
        val tx = transactionJson(
            txid = txid,
            inputs = listOf(
                inputJson(inputTxid, 0, p2pkhScriptSig, null, p2pkhScript()),
                inputJson(inputTxid, 1, "", listOf("30".repeat(70), compressedKey), p2wpkhScript()),
                inputJson(inputTxid, 2, p2shScriptSig, listOf("30".repeat(70), compressedKey), p2shScript()),
                inputJson(inputTxid, 3, "", taprootKeyPathWitness(), p2trScript(xOnlyKey)),
            ),
            outputs = listOf(outputJson(xOnlyKey, 123, "true")),
        )

        val parsed = EsploraTransactionParser.parse(tx, blockHeight = 100, transactionIndex = 7)

        assertEquals(4, parsed.allInputOutpoints.size)
        assertEquals(4, parsed.eligibleInputs.size)
        assertEquals(1, parsed.allInputOutpoints.first().txidLittleEndian[0].toInt())
        assertEquals(3, parsed.allInputOutpoints.last().vout)
        assertTrue(parsed.eligibleInputs[0].publicKey is EligiblePublicKey.Compressed)
        assertTrue(parsed.eligibleInputs[1].publicKey is EligiblePublicKey.Compressed)
        assertTrue(parsed.eligibleInputs[2].publicKey is EligiblePublicKey.Compressed)
        assertTrue(parsed.eligibleInputs[3].publicKey is EligiblePublicKey.XOnly)
        assertEquals(1, parsed.outputs.size)
        assertTrue(parsed.outputs.single().isUnspent)
        assertTrue(parsed.outputs.single().spentnessKnown)
        assertEquals(1, parsed.outputs.single().outpoint.txidLittleEndian[0].toInt())
    }

    @Test
    fun parserSkipsTransactionsWithNoEligibleInputs() {
        val tx = transactionJson(
            txid = "aa".repeat(32),
            inputs = listOf(
                inputJson(
                    txid = "bb".repeat(32),
                    vout = 0,
                    scriptSig = "",
                    witness = null,
                    prevoutScript = "6a01ff",
                ),
            ),
            outputs = listOf(
                "{\"value\":1,\"scriptpubkey\":\"0014${"cc".repeat(20)}\"}",
                outputJson("dd".repeat(32), 456, null),
            ),
        )

        val reason = runCatching { EsploraTransactionParser.parse(tx, blockHeight = 1, transactionIndex = 0) }
            .exceptionOrNull()
            ?.let { (it as EsploraTransactionParseException).reason }

        assertEquals("NO_ELIGIBLE_INPUTS", reason)
    }

    @Test
    fun parserIgnoresValidP2wshInputsButRetainsTheirOutpoints() {
        val tx = transactionJson(
            txid = "ac".repeat(32),
            inputs = listOf(
                inputJson("ad".repeat(32), 0, "", null, "0020${"11".repeat(32)}"),
                inputJson("ae".repeat(32), 1, "", taprootKeyPathWitness(), p2trScript("22".repeat(32))),
            ),
            outputs = listOf(outputJson("23".repeat(32), 2, null)),
        )

        val parsed = EsploraTransactionParser.parse(tx, blockHeight = 1, transactionIndex = 0)

        assertEquals(2, parsed.allInputOutpoints.size)
        assertEquals(1, parsed.eligibleInputs.size)
        assertEquals(0, parsed.allInputOutpoints.first().vout)
    }

    @Test
    fun parserSkipsCoinbaseBeforeAttemptingOutpointExtraction() {
        val tx = """
            {"txid":"${"af".repeat(32)}","vin":[{"coinbase":"03ffff00"}],"vout":[${outputJson("24".repeat(32), 1, null)}]}
        """.trimIndent()

        val reason = runCatching { EsploraTransactionParser.parse(tx, 1, 0) }
            .exceptionOrNull()
            ?.let { (it as EsploraTransactionParseException).reason }

        assertEquals("COINBASE", reason)
    }

    @Test
    fun parserSkipsTransactionsWithoutTaprootOutputs() {
        val tx = transactionJson(
            txid = "0a".repeat(32),
            inputs = listOf(
                inputJson("0b".repeat(32), 0, "", null, "6a01ff"),
            ),
            outputs = listOf("{\"value\":1,\"scriptpubkey\":\"6a01ff\"}"),
        )

        val reason = runCatching { EsploraTransactionParser.parse(tx, 1, 0) }
            .exceptionOrNull()
            ?.let { (it as EsploraTransactionParseException).reason }

        assertEquals("NO_TAPROOT_OUTPUTS", reason)
    }

    @Test
    fun parserRejectsUnsupportedWitnessVersionsAndMalformedEligibleInputs() {
        val unsupported = transactionJson(
            txid = "01".repeat(32),
            inputs = listOf(
                inputJson("02".repeat(32), 0, "", null, "5220${"03".repeat(32)}"),
            ),
            outputs = emptyList(),
        )
        val malformed = transactionJson(
            txid = "04".repeat(32),
            inputs = listOf(
                inputJson("05".repeat(32), 0, "", null, p2wpkhScript()),
            ),
            outputs = emptyList(),
        )

        assertEquals(
            "UNSUPPORTED_WITNESS_VERSION",
            runCatching { EsploraTransactionParser.parse(unsupported, 1, 0) }
                .exceptionOrNull()
                ?.let { (it as EsploraTransactionParseException).reason },
        )
        assertEquals(
            "MISSING_WITNESS",
            runCatching { EsploraTransactionParser.parse(malformed, 1, 0) }
                .exceptionOrNull()
                ?.let { (it as EsploraTransactionParseException).reason },
        )

        val malformedV0Program = transactionJson(
            txid = "14".repeat(32),
            inputs = listOf(
                inputJson("15".repeat(32), 0, "", null, "0015${"16".repeat(21)}"),
            ),
            outputs = emptyList(),
        )
        assertEquals(
            "MALFORMED_WITNESS_PROGRAM",
            runCatching { EsploraTransactionParser.parse(malformedV0Program, 1, 0) }
                .exceptionOrNull()
                ?.let { (it as EsploraTransactionParseException).reason },
        )
    }

    @Test
    fun parserRejectsMalformedTaprootKeyPathWitness() {
        val malformed = transactionJson(
            txid = "03".repeat(32),
            inputs = listOf(
                inputJson("04".repeat(32), 0, "", listOf("01"), p2trScript("05".repeat(32))),
            ),
            outputs = listOf(outputJson("06".repeat(32), 1, null)),
        )

        val reason = runCatching { EsploraTransactionParser.parse(malformed, 1, 0) }
            .exceptionOrNull()
            ?.let { (it as EsploraTransactionParseException).reason }

        assertEquals("MALFORMED_TAPROOT_WITNESS", reason)
    }

    @Test
    fun parserFindsP2pkhKeyInsideNonStandardScriptSig() {
        val compressedKey = "03" + "44".repeat(32)
        val nonStandardScriptSig = "01aa75" + "46" + "01".repeat(70) + "21" + compressedKey
        val tx = transactionJson(
            txid = "06".repeat(32),
            inputs = listOf(
                inputJson("07".repeat(32), 0, nonStandardScriptSig, null, p2pkhScript()),
            ),
            outputs = listOf(outputJson("aa".repeat(32), 1, null)),
        )

        val parsed = EsploraTransactionParser.parse(tx, blockHeight = 1, transactionIndex = 0)

        assertEquals(1, parsed.eligibleInputs.size)
        assertTrue(parsed.eligibleInputs.single().publicKey is EligiblePublicKey.Compressed)
    }

    @Test
    fun parserSkipsNumsTaprootScriptPathInputs() {
        val numsInternalKey = "50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0"
        val tx = transactionJson(
            txid = "08".repeat(32),
            inputs = listOf(
                inputJson(
                    txid = "09".repeat(32),
                    vout = 0,
                    scriptSig = "",
                    witness = listOf("51", "c0$numsInternalKey"),
                    prevoutScript = p2trScript("aa".repeat(32)),
                ),
                inputJson(
                    txid = "0a".repeat(32),
                    vout = 1,
                    scriptSig = "",
                    witness = taprootKeyPathWitness(),
                    prevoutScript = p2trScript("bb".repeat(32)),
                ),
            ),
            outputs = listOf(outputJson("bb".repeat(32), 1, null)),
        )

        val parsed = EsploraTransactionParser.parse(tx, blockHeight = 1, transactionIndex = 0)

        assertEquals(2, parsed.allInputOutpoints.size)
        assertEquals(1, parsed.eligibleInputs.size)
    }

    @Test
    fun parserIncludesNonNumsTaprootScriptPathUsingTheOutputKey() {
        val tx = transactionJson(
            txid = "0c".repeat(32),
            inputs = listOf(
                inputJson(
                    txid = "0d".repeat(32),
                    vout = 0,
                    scriptSig = "",
                    witness = listOf("51", "c0${"aa".repeat(32)}"),
                    prevoutScript = p2trScript("bb".repeat(32)),
                ),
            ),
            outputs = listOf(outputJson("bc".repeat(32), 1, null)),
        )

        val parsed = EsploraTransactionParser.parse(tx, blockHeight = 1, transactionIndex = 0)

        assertEquals(1, parsed.eligibleInputs.size)
        assertTrue(parsed.eligibleInputs.single().publicKey is EligiblePublicKey.XOnly)
    }

    @Test
    fun parserRejectsDuplicateInputOutpointsAndMalformedValues() {
        val duplicateOutpoint = transactionJson(
            txid = "0e".repeat(32),
            inputs = listOf(
                inputJson("0f".repeat(32), 0, "", taprootKeyPathWitness(), p2trScript("11".repeat(32))),
                inputJson("0f".repeat(32), 0, "", taprootKeyPathWitness(), p2trScript("22".repeat(32))),
            ),
            outputs = listOf(outputJson("23".repeat(32), 1, null)),
        )
        val malformedValue = transactionJson(
            txid = "10".repeat(32),
            inputs = listOf(inputJson("11".repeat(32), 0, "", taprootKeyPathWitness(), p2trScript("12".repeat(32)))),
            outputs = listOf(outputJson("13".repeat(32), 2_100_000_000_000_001L, null)),
        )

        assertEquals(
            "DUPLICATE_INPUT_OUTPOINT",
            runCatching { EsploraTransactionParser.parse(duplicateOutpoint, 1, 0) }
                .exceptionOrNull()
                ?.let { (it as EsploraTransactionParseException).reason },
        )
        assertEquals(
            "INVALID_VALUE",
            runCatching { EsploraTransactionParser.parse(malformedValue, 1, 0) }
                .exceptionOrNull()
                ?.let { (it as EsploraTransactionParseException).reason },
        )
    }

    @Test
    fun sourcePaginatesInOrderAndEmitsAReorgCheckpointOnlyAfterFinalBatch() = runBlocking {
        val blockHash = "ab".repeat(32)
        val previousHash = "cd".repeat(32)
        val txs = (0 until 26).map { index ->
            transactionJson(
                txid = index.toString(16).padStart(2, '0').repeat(32),
                inputs = listOf(
                    inputJson("ef".repeat(32), index.toLong(), "", taprootKeyPathWitness(), p2trScript("11".repeat(32))),
                ),
                outputs = listOf(outputJson("10".repeat(32), 1, null)),
            )
        }
        val client = FakeEsploraHttpClient(
            mapOf(
                "/blocks/tip/height" to "200",
                "/blocks/tip/hash" to "ff".repeat(32),
                "/block-height/100" to blockHash,
                "/block-height/99" to previousHash,
                "/block/$blockHash" to """
                    {"id":"$blockHash","height":100,"previousblockhash":"$previousHash","tx_count":26}
                """.trimIndent(),
                "/block/$blockHash/txids" to "[${txs.joinToString(",") { "\"${transactionIdFromJson(it)}\"" }}]",
                "/block/$blockHash/txs/0" to txs.take(25).joinToString(prefix = "[", postfix = "]"),
                "/block/$blockHash/txs/25" to "[${txs[25]}]",
            ),
        )
        val batches = ArrayList<SilentPaymentBatch>()

        EsploraBlockSource(client).batches(
            SilentPaymentNetwork.MAINNET,
            ScanRange(100, 100),
        ).collect { batches += it }

        assertEquals(1, batches.size)
        assertEquals(26, batches.single().transactions.size)
        assertTrue(batches.single().isFinalBatchForBlock)
        assertEquals((0 until 26).map { it.toLong() }, batches.single().transactions.map { it.transactionIndex })
        assertEquals(listOf("/blocks/tip/height", "/blocks/tip/hash", "/block-height/100", "/block-height/99", "/block/$blockHash", "/block/$blockHash/txids", "/block/$blockHash/txs/0", "/block/$blockHash/txs/25"), client.paths)
    }

    @Test
    fun sourceRejectsDuplicateCanonicalTransactionIdsBeforeScanningPages() = runBlocking {
        val blockHash = "bc".repeat(32)
        val parentHash = "bd".repeat(32)
        val duplicateId = "be".repeat(32)
        val client = FakeEsploraHttpClient(
            mapOf(
                "/blocks/tip/height" to "200",
                "/blocks/tip/hash" to "ff".repeat(32),
                "/block-height/100" to blockHash,
                "/block-height/99" to parentHash,
                "/block/$blockHash" to "{\"id\":\"$blockHash\",\"height\":100,\"previousblockhash\":\"$parentHash\",\"tx_count\":2}",
                "/block/$blockHash/txids" to "[\"$duplicateId\",\"$duplicateId\"]",
            ),
        )

        val error = runCatching {
            EsploraBlockSource(client).batches(
                SilentPaymentNetwork.MAINNET,
                ScanRange(100, 100),
            ).collect { }
        }.exceptionOrNull()

        assertTrue(error is NativeSilentPaymentException)
        assertEquals(NativeErrorCode.INVALID_PUBLIC_RECORD, (error as NativeSilentPaymentException).code)
        assertFalse(client.paths.any { it.contains("/txs/") })
    }

    @Test
    fun sourceRejectsMalformedPageTxidsBeforeNativeScanning() = runBlocking {
        val blockHash = "bf".repeat(32)
        val parentHash = "c0".repeat(32)
        val canonicalId = "c1".repeat(32)
        val malformedTransaction = transactionJson(
            txid = "zz",
            inputs = listOf(inputJson("c2".repeat(32), 0, "", taprootKeyPathWitness(), p2trScript("33".repeat(32)))),
            outputs = listOf(outputJson("34".repeat(32), 1, null)),
        )
        val client = FakeEsploraHttpClient(
            mapOf(
                "/blocks/tip/height" to "200",
                "/blocks/tip/hash" to "ff".repeat(32),
                "/block-height/100" to blockHash,
                "/block-height/99" to parentHash,
                "/block/$blockHash" to "{\"id\":\"$blockHash\",\"height\":100,\"previousblockhash\":\"$parentHash\",\"tx_count\":1}",
                "/block/$blockHash/txids" to "[\"$canonicalId\"]",
                "/block/$blockHash/txs/0" to "[$malformedTransaction]",
            ),
        )

        val error = runCatching {
            EsploraBlockSource(client).batches(
                SilentPaymentNetwork.MAINNET,
                ScanRange(100, 100),
            ).collect { }
        }.exceptionOrNull()

        assertTrue(error is NativeSilentPaymentException)
        assertEquals(NativeErrorCode.INVALID_PUBLIC_RECORD, (error as NativeSilentPaymentException).code)
    }

    @Test
    fun sourceSplitsLargeBlocksIntoOrderedNonOverlappingBatches() = runBlocking {
        val blockHash = "12".repeat(32)
        val transactions = (0 until 1_025).map { index ->
            transactionJson(
                txid = index.toString(16).padStart(4, '0').repeat(16),
                inputs = listOf(inputJson("34".repeat(32), index.toLong(), "", taprootKeyPathWitness(), p2trScript("20".repeat(32)))),
                outputs = listOf(outputJson("20".repeat(32), 1, null)),
            )
        }
        val client = object : EsploraHttpClient {
            override suspend fun get(network: SilentPaymentNetwork, path: String, maxBytes: Int): String = when {
                path == "/blocks/tip/height" -> "500"
                path == "/blocks/tip/hash" -> "56".repeat(32)
                path == "/block-height/100" -> blockHash
                path == "/block-height/99" -> "78".repeat(32)
                path == "/block/$blockHash" ->
                    "{\"id\":\"$blockHash\",\"height\":100,\"previousblockhash\":\"${"78".repeat(32)}\",\"tx_count\":1025}"
                path == "/block/$blockHash/txids" ->
                    "[${transactions.joinToString(",") { tx -> "\"${transactionIdFromJson(tx)}\"" }}]"
                path.startsWith("/block/$blockHash/txs/") -> {
                    val offset = path.substringAfterLast('/').toInt()
                    transactions.drop(offset).take(25).joinToString(prefix = "[", postfix = "]")
                }
                else -> error("unexpected path: $path")
            }
        }
        val batches = ArrayList<SilentPaymentBatch>()

        EsploraBlockSource(client).batches(
            SilentPaymentNetwork.MAINNET,
            ScanRange(100, 100),
        ).collect { batches += it }

        assertEquals(listOf(1_024, 1), batches.map { it.transactions.size })
        assertEquals(listOf(0L, 1_024L), batches.map { it.batchTransactionOffset })
        assertFalse(batches[0].isFinalBatchForBlock)
        assertTrue(batches[1].isFinalBatchForBlock)
        assertEquals(0L, batches[0].transactions.first().transactionIndex)
        assertEquals(1_023L, batches[0].transactions.last().transactionIndex)
        assertEquals(1_024L, batches[1].transactions.single().transactionIndex)
    }

    @Test
    fun finalEmptyCheckpointPreservesSkippedDiagnosticsAfterBatchBoundary() = runBlocking {
        val blockHash = "17".repeat(32)
        val parentHash = "18".repeat(32)
        val transactions = (0 until 1_025).map { index ->
            if (index == 1_024) {
                transactionJson(
                    txid = "19".repeat(32),
                    inputs = emptyList(),
                    outputs = listOf(outputJson("1c".repeat(32), 1, null)),
                )
            } else {
                transactionJson(
                    txid = index.toString(16).padStart(4, '0').repeat(16),
                    inputs = listOf(inputJson("1a".repeat(32), index.toLong(), "", taprootKeyPathWitness(), p2trScript("20".repeat(32)))),
                    outputs = listOf(outputJson("20".repeat(32), 1, null)),
                )
            }
        }
        val client = object : EsploraHttpClient {
            override suspend fun get(network: SilentPaymentNetwork, path: String, maxBytes: Int): String = when {
                path == "/blocks/tip/height" -> "500"
                path == "/blocks/tip/hash" -> "1b".repeat(32)
                path == "/block-height/100" -> blockHash
                path == "/block-height/99" -> parentHash
                path == "/block/$blockHash" ->
                    "{\"id\":\"$blockHash\",\"height\":100,\"previousblockhash\":\"$parentHash\",\"tx_count\":1025}"
                path == "/block/$blockHash/txids" ->
                    "[${transactions.joinToString(",") { tx -> "\"${transactionIdFromJson(tx)}\"" }}]"
                path.startsWith("/block/$blockHash/txs/") -> {
                    val offset = path.substringAfterLast('/').toInt()
                    transactions.drop(offset).take(25).joinToString(prefix = "[", postfix = "]")
                }
                else -> error("unexpected path: $path")
            }
        }
        val batches = ArrayList<SilentPaymentBatch>()

        EsploraBlockSource(client).batches(
            SilentPaymentNetwork.MAINNET,
            ScanRange(100, 100),
        ).collect { batches += it }

        assertEquals(listOf(1_024, 0), batches.map { it.transactions.size })
        assertEquals(1L, batches.last().skippedTransactionCount)
        assertEquals(listOf("NO_ELIGIBLE_INPUTS"), batches.last().skipReasons)
        assertEquals(1_024L, batches.last().batchTransactionOffset)
        assertTrue(batches.last().isFinalBatchForBlock)
    }

    @Test
    fun sourcePropagatesCancellationBeforeAllocatingLaterPages() {
        val client = object : EsploraHttpClient {
            override suspend fun get(network: SilentPaymentNetwork, path: String, maxBytes: Int): String {
                if (path == "/blocks/tip/hash") throw CancellationException("cancelled")
                return when (path) {
                    "/blocks/tip/height" -> "10"
                    else -> error("unexpected path: $path")
                }
            }
        }

        val error = runCatching {
            runBlocking {
                EsploraBlockSource(client).batches(
                    SilentPaymentNetwork.MAINNET,
                    ScanRange(1, 1),
                ).collect { }
            }
        }.exceptionOrNull()

        assertTrue(error is CancellationException)
    }

    private class FakeEsploraHttpClient(private val responses: Map<String, String>) : EsploraHttpClient {
        val paths = ArrayList<String>()

        override suspend fun get(network: SilentPaymentNetwork, path: String, maxBytes: Int): String {
            paths += path
            return responses[path] ?: error("missing fixture: $path")
        }
    }

    private fun transactionJson(
        txid: String,
        inputs: List<String>,
        outputs: List<String>,
    ): String = """
        {"txid":"$txid","vin":[${inputs.joinToString(",")}],"vout":[${outputs.joinToString(",")}]}
    """.trimIndent()

    private fun inputJson(
        txid: String,
        vout: Long,
        scriptSig: String,
        witness: List<String>?,
        prevoutScript: String,
    ): String {
        val witnessJson = witness?.joinToString(prefix = "[\"", postfix = "\"]", separator = "\",\"") ?: "null"
        return """
            {"txid":"$txid","vout":$vout,"scriptsig":"$scriptSig","witness":$witnessJson,"prevout":{"scriptpubkey":"$prevoutScript"}}
        """.trimIndent()
    }

    private fun outputJson(key: String, value: Long, isUnspent: String?): String {
        val spent = isUnspent?.let { ",\"is_unspent\":$it" } ?: ""
        return "{\"value\":$value,\"scriptpubkey\":\"5120$key\"$spent}"
    }

    private fun transactionIdFromJson(transaction: String): String =
        Regex("\\\"txid\\\":\\\"([0-9a-f]+)\\\"").find(transaction)?.groupValues?.get(1)
            ?: error("missing fixture txid")

    private fun p2pkhScript(): String = "76a914adfce54f529b2154e3c361bbe3f7d41db063571788ac"
    private fun p2wpkhScript(): String = "0014adfce54f529b2154e3c361bbe3f7d41db0635717"
    private fun p2shScript(): String = "a914173727a17ada832a0fd90be6c628f63598b3400f87"
    private fun p2trScript(key: String): String = "5120$key"
    private fun taprootKeyPathWitness(): List<String> = listOf("40".repeat(64))
}
