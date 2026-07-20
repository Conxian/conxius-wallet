package com.conxius.wallet.bitcoin

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HashSet
import kotlinx.coroutines.Job

/**
* A fixed, validated Esplora endpoint. Production callers use [forNetwork] and cannot provide a
* JavaScript-controlled URL. Custom endpoints are available only to host/unit test seams and
* still require HTTPS plus an explicitly allowed host.
*/
data class EsploraEndpoint private constructor(val baseUrl: String) {
    init {
        val uri = URI(baseUrl)
        require(uri.scheme == "https") { "Esplora endpoint must use HTTPS" }
        require(uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "Esplora endpoint must not contain credentials or query data"
        }
        require(uri.host in ALLOWED_HOSTS) { "Esplora endpoint host is not allowlisted" }
        require(uri.port == -1 || uri.port == 443) { "Esplora endpoint port is not allowlisted" }
        require(uri.rawPath in ALLOWED_PATHS) { "Esplora endpoint path is not allowlisted" }
    }

    fun path(path: String): String {
        require(path.startsWith('/') && !path.startsWith("//")) { "Esplora path must be absolute" }
        require(!path.contains("..") && !path.contains("\\")) { "invalid Esplora path" }
        return baseUrl + path
    }

    companion object {
        private val ALLOWED_HOSTS = setOf("blockstream.info", "mempool.space")
        private val ALLOWED_PATHS = setOf("/api", "/testnet/api", "/signet/api")

        fun forNetwork(network: SilentPaymentNetwork): EsploraEndpoint = when (network) {
            SilentPaymentNetwork.MAINNET -> EsploraEndpoint("https://blockstream.info/api")
            SilentPaymentNetwork.TESTNET -> EsploraEndpoint("https://blockstream.info/testnet/api")
            SilentPaymentNetwork.SIGNET -> EsploraEndpoint("https://mempool.space/signet/api")
            SilentPaymentNetwork.REGTEST -> throw NativeSilentPaymentException(NativeErrorCode.INVALID_NETWORK)
        }

        /** Test-only constructor; it remains subject to the same scheme/host policy. */
        fun fromValidatedUrl(url: String): EsploraEndpoint =
            EsploraEndpoint(url.trimEnd('/'))
    }
}

/** Minimal cancellable transport seam; no OkHttp dependency or broad Android upgrade is needed. */
interface EsploraHttpClient {
    suspend fun get(network: SilentPaymentNetwork, path: String, maxBytes: Int): String
}

class UrlConnectionEsploraHttpClient(
    private val endpoints: Map<SilentPaymentNetwork, EsploraEndpoint> = mapOf(
        SilentPaymentNetwork.MAINNET to EsploraEndpoint.forNetwork(SilentPaymentNetwork.MAINNET),
        SilentPaymentNetwork.TESTNET to EsploraEndpoint.forNetwork(SilentPaymentNetwork.TESTNET),
        SilentPaymentNetwork.SIGNET to EsploraEndpoint.forNetwork(SilentPaymentNetwork.SIGNET),
    ),
    private val connectTimeoutMillis: Int = 12_000,
    private val readTimeoutMillis: Int = 12_000,
) : EsploraHttpClient {
    override suspend fun get(network: SilentPaymentNetwork, path: String, maxBytes: Int): String =
        withContext(Dispatchers.IO) {
            currentCoroutineContext().ensureActive()
            val endpoint = endpoints[network]
                ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_NETWORK)
            val connection = try {
                (URL(endpoint.path(path)).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = connectTimeoutMillis
                    readTimeout = readTimeoutMillis
                    useCaches = false
                    instanceFollowRedirects = false
                    setRequestProperty("Accept", "application/json,text/plain")
                }
            } catch (error: IOException) {
                throw NativeSilentPaymentException(NativeErrorCode.NETWORK_UNAVAILABLE, error)
            }

            val cancellationRegistration = currentCoroutineContext()[Job]?.invokeOnCompletion {
                connection.disconnect()
            }
            try {
                val status = connection.responseCode
                if (status !in 200..299) {
                    throw NativeSilentPaymentException(NativeErrorCode.NETWORK_UNAVAILABLE)
                }
                val declaredLength = connection.contentLengthLong
                if (declaredLength > maxBytes.toLong()) {
                    throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
                }
                val bytes = connection.inputStream.use { input -> readBounded(input, maxBytes) }
                String(bytes, StandardCharsets.UTF_8)
            } catch (error: CancellationException) {
                throw error
            } catch (error: NativeSilentPaymentException) {
                throw error
            } catch (error: IOException) {
                throw NativeSilentPaymentException(NativeErrorCode.NETWORK_UNAVAILABLE, error)
            } finally {
                cancellationRegistration?.dispose()
                connection.disconnect()
            }
        }

    private fun readBounded(input: java.io.InputStream, maxBytes: Int): ByteArray {
        if (maxBytes < 0) throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        val output = ByteArrayOutputStream(minOf(maxBytes, 16 * 1024))
        val buffer = ByteArray(8 * 1024)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (output.size().toLong() + read.toLong() > maxBytes.toLong()) {
                throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
            }
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }
}

data class EsploraBlockSummary(
    val hash: String,
    val height: Long,
    val previousBlockHash: String?,
    val transactionCount: Long,
)

/**
* Production Esplora block source. It fetches blocks in ascending height order and emits bounded
* SPB1-compatible batches. A large block is split into non-overlapping batches; the scan cursor
* advances only after the final batch for that block has been durably persisted. Esplora JSON is
* treated as allowlisted, bounded, trusted metadata: this source checks shape, bounds, continuity,
* and cross-record consistency, but it does not cryptographically verify raw transaction bytes or
* independently prove a transaction id from a serialized transaction.
*/
class EsploraBlockSource(
    private val httpClient: EsploraHttpClient = UrlConnectionEsploraHttpClient(),
) : BlockSource {
    companion object {
        const val MAX_BLOCK_RESPONSE_BYTES = 128 * 1024
        const val MAX_TRANSACTION_PAGE_BYTES = 8 * 1024 * 1024
        const val MAX_TXIDS_RESPONSE_BYTES = 8 * 1024 * 1024
        const val MAX_TRANSACTION_BYTES = 512 * 1024
        const val MAX_TRANSACTIONS_PER_BLOCK = 100_000L
        const val MAX_TRANSACTIONS_PER_BATCH = SilentPaymentCodec.MAX_BATCH_TRANSACTIONS
        const val ESPLORA_PAGE_SIZE = 25
        const val MAX_SKIP_DIAGNOSTICS = 32
    }

    override fun batches(
        network: SilentPaymentNetwork,
        range: ScanRange,
    ): Flow<SilentPaymentBatch> = flow {
        val blockSpan = try {
            Math.subtractExact(range.endBlock, range.startBlock)
        } catch (_: ArithmeticException) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        if (blockSpan !in 0 until MAX_SCAN_BLOCKS) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }

        val tipHeight = parseHeight(
            httpClient.get(network, "/blocks/tip/height", 64),
        )
        if (range.endBlock > tipHeight) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_REQUEST)
        }
        val tipHash = parseHash(
            httpClient.get(network, "/blocks/tip/hash", 128),
        )

        var expectedPreviousHash: String? = null
        var firstRequestedBlock = true
        for (height in range.startBlock..range.endBlock) {
            currentCoroutineContext().ensureActive()
            val blockHash = parseHash(
                httpClient.get(network, "/block-height/$height", 128),
            )
            val summary = parseBlockSummary(
                httpClient.get(network, "/block/$blockHash", MAX_BLOCK_RESPONSE_BYTES),
            )
            if (summary.hash != blockHash || summary.height != height) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }
            if (height > 0 && summary.previousBlockHash == null) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }
            if (firstRequestedBlock && height > 0) {
                val canonicalParentHash = parseHash(
                    httpClient.get(network, "/block-height/${height - 1}", 128),
                )
                if (summary.previousBlockHash != canonicalParentHash) {
                    throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
                }
            }
            if (expectedPreviousHash != null && summary.previousBlockHash != expectedPreviousHash) {
                throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
            }
            if (summary.transactionCount !in 0..MAX_TRANSACTIONS_PER_BLOCK) {
                throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
            }

            val canonicalTransactionIds = parseTransactionIds(
                httpClient.get(
                    network,
                    "/block/$blockHash/txids",
                    MAX_TXIDS_RESPONSE_BYTES,
                ),
            )
            if (canonicalTransactionIds.size.toLong() != summary.transactionCount
                || canonicalTransactionIds.toSet().size != canonicalTransactionIds.size
            ) {
                throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
            }

            val parsedTransactions = ArrayList<SilentPaymentTransaction>(
                minOf(summary.transactionCount, MAX_TRANSACTIONS_PER_BATCH.toLong()).toInt(),
            )
            var skippedCount = 0L
            val skipReasons = ArrayList<String>(MAX_SKIP_DIAGNOSTICS)
            val seenTransactionIds = HashSet<String>()
            var pageOffset = 0L
            var batchOffset = 0L

            while (pageOffset < summary.transactionCount) {
                currentCoroutineContext().ensureActive()
                val page = parseTransactionPage(
                    httpClient.get(
                        network,
                        "/block/$blockHash/txs/$pageOffset",
                        MAX_TRANSACTION_PAGE_BYTES,
                    ),
                )
                if (page.isEmpty() || page.size > ESPLORA_PAGE_SIZE
                    || pageOffset + page.size.toLong() > summary.transactionCount
                ) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                val expectedPageSize = minOf(
                    ESPLORA_PAGE_SIZE.toLong(),
                    summary.transactionCount - pageOffset,
                )
                if (page.size.toLong() != expectedPageSize) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }

                page.forEachIndexed { pageIndex, transactionJson ->
                    currentCoroutineContext().ensureActive()
                    val transactionIndex = pageOffset + pageIndex.toLong()
                    val announcedTransactionId = transactionIdOrNull(transactionJson)
                        ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                    if (announcedTransactionId != canonicalTransactionIds[transactionIndex.toInt()]) {
                        throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                    }
                    try {
                        val parsed = EsploraTransactionParser.parse(
                            json = transactionJson,
                            blockHeight = height,
                            transactionIndex = transactionIndex,
                        )
                        val transactionId = parsed.transactionIdLittleEndian.reversedArray().toHexKey()
                        if (transactionId != canonicalTransactionIds[transactionIndex.toInt()]) {
                            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                        }
                        if (!seenTransactionIds.add(transactionId)) {
                            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                        }
                        parsedTransactions += parsed
                    } catch (error: EsploraTransactionParseException) {
                        skippedCount++
                        if (skipReasons.size < MAX_SKIP_DIAGNOSTICS) {
                            skipReasons += error.reason
                        }
                    }

                    if (parsedTransactions.size >= MAX_TRANSACTIONS_PER_BATCH) {
                        emit(
                            SilentPaymentBatch(
                                network = network,
                                range = range,
                                transactions = parsedTransactions.toList(),
                                blockHeight = height,
                                blockHash = blockHash,
                                previousBlockHash = summary.previousBlockHash,
                                currentTipHeight = tipHeight,
                                currentTipHash = tipHash,
                                skippedTransactionCount = skippedCount,
                                skipReasons = skipReasons.toList(),
                                batchTransactionOffset = batchOffset,
                                isFinalBatchForBlock = false,
                            ),
                        )
                        batchOffset += parsedTransactions.size.toLong()
                        parsedTransactions.clear()
                        skippedCount = 0
                        skipReasons.clear()
                    }
                }
                pageOffset += page.size.toLong()
            }

            if (height == tipHeight) {
                val observedTipHeight = parseHeight(
                    httpClient.get(network, "/blocks/tip/height", 64),
                )
                val observedTipHash = parseHash(
                    httpClient.get(network, "/blocks/tip/hash", 128),
                )
                if (observedTipHeight != tipHeight || observedTipHash != tipHash
                    || observedTipHash != blockHash
                ) {
                    throw NativeSilentPaymentException(NativeErrorCode.REORG_DETECTED)
                }
            }

            if (parsedTransactions.isNotEmpty() || batchOffset == 0L) {
                emit(
                    SilentPaymentBatch(
                        network = network,
                        range = range,
                        transactions = parsedTransactions.toList(),
                        blockHeight = height,
                        blockHash = blockHash,
                        previousBlockHash = summary.previousBlockHash,
                        currentTipHeight = tipHeight,
                        currentTipHash = tipHash,
                        skippedTransactionCount = skippedCount,
                        skipReasons = skipReasons.toList(),
                        batchTransactionOffset = batchOffset,
                        isFinalBatchForBlock = true,
                    ),
                )
            } else {
                // The final batch can be empty when the block ended exactly on a batch boundary;
                // emit an explicit checkpoint so the block cursor still advances atomically.
                emit(
                    SilentPaymentBatch(
                        network = network,
                        range = range,
                        transactions = emptyList(),
                        blockHeight = height,
                        blockHash = blockHash,
                        previousBlockHash = summary.previousBlockHash,
                        currentTipHeight = tipHeight,
                        currentTipHash = tipHash,
                        skippedTransactionCount = skippedCount,
                        skipReasons = skipReasons.toList(),
                        batchTransactionOffset = batchOffset,
                        isFinalBatchForBlock = true,
                    ),
                )
            }
            expectedPreviousHash = blockHash
            firstRequestedBlock = false
        }
    }

    private fun parseHeight(raw: String): Long =
        raw.trim().takeIf { it.length <= 20 }?.toLongOrNull()?.takeIf { it >= 0 }
            ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)

    private fun parseHash(raw: String): String =
        raw.trim().lowercase().takeIf { it.matches(HEX_64) }
            ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)

    private fun parseBlockSummary(raw: String): EsploraBlockSummary {
        val obj = boundedJsonObject(raw)
        val hash = requiredHash(obj, "id")
        val height = requiredLong(obj, "height")
        val previousRaw = (obj.opt("previousblockhash") as? String).orEmpty().trim()
        val previous = if (previousRaw.isEmpty()) {
            null
        } else {
            parseHash(previousRaw)
        }
        val txCount = requiredLong(obj, "tx_count")
        return EsploraBlockSummary(hash, height, previous, txCount)
    }

    private fun parseTransactionPage(raw: String): List<String> {
        val array = boundedJsonArray(raw)
        val size = array.length()
        if (size > ESPLORA_PAGE_SIZE) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        return ArrayList<String>(size).also { result ->
            repeat(size) { index ->
                val value = array.opt(index)
                if (value !is JSONObject) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                val encoded = value.toString()
                if (encoded.toByteArray(StandardCharsets.UTF_8).size > MAX_TRANSACTION_BYTES) {
                    throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
                }
                result += encoded
            }
        }
    }

    private fun parseTransactionIds(raw: String): List<String> {
        if (raw.toByteArray(StandardCharsets.UTF_8).size > MAX_TXIDS_RESPONSE_BYTES) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        val array = try {
            JSONArray(raw)
        } catch (_: Exception) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
        if (array.length().toLong() > MAX_TRANSACTIONS_PER_BLOCK) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        return ArrayList<String>(array.length()).also { result ->
            repeat(array.length()) { index ->
                val value = array.opt(index)
                if (value !is String || !value.lowercase().matches(HEX_64)) {
                    throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
                }
                result += value.lowercase()
            }
        }
    }

    private fun transactionIdOrNull(raw: String): String? = runCatching {
        val value = JSONObject(raw).opt("txid")
        (value as? String)?.lowercase()?.takeIf { it.matches(HEX_64) }
    }.getOrNull()

    private fun boundedJsonObject(raw: String): JSONObject {
        if (raw.toByteArray(StandardCharsets.UTF_8).size > MAX_BLOCK_RESPONSE_BYTES) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        return try {
            JSONObject(raw)
        } catch (_: Exception) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
    }

    private fun boundedJsonArray(raw: String): JSONArray {
        if (raw.toByteArray(StandardCharsets.UTF_8).size > MAX_TRANSACTION_PAGE_BYTES) {
            throw NativeSilentPaymentException(NativeErrorCode.RESOURCE_LIMIT)
        }
        return try {
            JSONArray(raw)
        } catch (_: Exception) {
            throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)
        }
    }

    private fun requiredLong(obj: JSONObject, key: String): Long =
        when (val value = obj.opt(key)) {
            is Int -> value.toLong().takeIf { it >= 0 }
            is Long -> value.takeIf { it >= 0 }
            is String -> value.toLongOrNull()?.takeIf { it >= 0 }
            else -> null
        } ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)

    private fun requiredHash(obj: JSONObject, key: String): String =
        obj.opt(key).let { value ->
            (value as? String)?.lowercase()?.takeIf { it.matches(HEX_64) }
        }
            ?: throw NativeSilentPaymentException(NativeErrorCode.INVALID_PUBLIC_RECORD)

    private fun ByteArray.toHexKey(): String =
        joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }

    private companion object {
        val HEX_64 = Regex("[0-9a-f]{64}")
    }
}

class EsploraTransactionParseException(val reason: String) : IllegalArgumentException(reason)

/** Public JSON-to-DTO parser used by the source and fixture-based host tests. */
object EsploraTransactionParser {
    private const val MAX_INPUTS = SilentPaymentCodec.MAX_TRANSACTION_INPUTS
    private const val MAX_OUTPUTS = SilentPaymentCodec.MAX_BATCH_OUTPUTS

    fun parse(json: String, blockHeight: Long, transactionIndex: Long): SilentPaymentTransaction {
        if (json.toByteArray(StandardCharsets.UTF_8).size > EsploraBlockSource.MAX_TRANSACTION_BYTES) {
            skip("TRANSACTION_TOO_LARGE")
        }
        val tx = try {
            JSONObject(json)
        } catch (_: Exception) {
            skip("MALFORMED_JSON")
        }
        val txid = requiredString(tx, "txid", 64)
        val txidLittleEndian = try {
            hexToBytes(txid, 32).reversedArray()
        } catch (_: Exception) {
            skip("MALFORMED_TXID")
        }

        val vin = tx.optJSONArray("vin") ?: skip("MISSING_INPUTS")
        val vout = tx.optJSONArray("vout") ?: skip("MISSING_OUTPUTS")
        if (vin.length() > MAX_INPUTS || vout.length() > MAX_OUTPUTS) {
            skip("RESOURCE_LIMIT")
        }

        val allInputOutpoints = ArrayList<OutPoint>(vin.length())
        val eligibleInputs = ArrayList<EligibleInput>(vin.length())
        val seenOutpoints = HashSet<String>(vin.length())
        repeat(vin.length()) { inputIndex ->
            val input = vin.optJSONObject(inputIndex) ?: skip("MALFORMED_INPUT")
            if (input.has("coinbase")) skip("COINBASE")
            val inputTxid = requiredString(input, "txid", 64)
            val inputVout = requiredUInt32(input, "vout")
            val inputTxidLe = try {
                hexToBytes(inputTxid, 32).reversedArray()
            } catch (_: Exception) {
                skip("MALFORMED_INPUT_OUTPOINT")
            }
            val outpoint = OutPoint(inputTxidLe, inputVout)
            val outpointKey = outpointKey(outpoint)
            if (!seenOutpoints.add(outpointKey)) skip("DUPLICATE_INPUT_OUTPOINT")
            allInputOutpoints += outpoint

            val prevout = input.optJSONObject("prevout") ?: skip("MISSING_PREVOUT")
            val prevoutScript = scriptHex(prevout, "scriptpubkey")
            val eligibility = classifyWitnessProgram(prevoutScript)
            when {
                isP2PKH(prevoutScript) -> {
                    val pubkey = parseP2pkhPublicKey(
                        scriptSig = scriptSigHex(input),
                        expectedHash = prevoutScript.copyOfRange(3, 23),
                    )
                    eligibleInputs += EligibleInput(outpoint, EligiblePublicKey.Compressed(pubkey))
                }
                isP2Wpkh(prevoutScript) -> {
                    val pubkey = parseWitnessPublicKey(
                        input,
                        expectedHash = prevoutScript.copyOfRange(2, 22),
                    )
                    eligibleInputs += EligibleInput(outpoint, EligiblePublicKey.Compressed(pubkey))
                }
                isP2Sh(prevoutScript) -> {
                    val redeemScript = parseSinglePushOrNull(scriptSigHex(input))
                    if (redeemScript != null && isP2Wpkh(redeemScript)
                        && hash160(redeemScript).contentEquals(prevoutScript.copyOfRange(2, 22))
                    ) {
                        val pubkey = parseWitnessPublicKey(
                            input,
                            expectedHash = redeemScript.copyOfRange(2, 22),
                        )
                        eligibleInputs += EligibleInput(outpoint, EligiblePublicKey.Compressed(pubkey))
                    }
                }
                isP2Tr(prevoutScript) -> {
                    when (taprootInputEligibility(input)) {
                        TaprootInputEligibility.NUMS_SCRIPT_PATH -> return@repeat
                        TaprootInputEligibility.ELIGIBLE -> Unit
                        TaprootInputEligibility.MALFORMED -> skip("MALFORMED_TAPROOT_WITNESS")
                    }
                    eligibleInputs += EligibleInput(
                        outpoint,
                        EligiblePublicKey.XOnly(prevoutScript.copyOfRange(2, 34)),
                    )
                }
                eligibility != null -> if (eligibility > 1) {
                    skip("UNSUPPORTED_WITNESS_VERSION")
                } else {
                    // Valid v0 P2WSH inputs are not eligible BIP-352 inputs. Their outpoints
                    // remain in allInputOutpoints and still participate in input hashing.
                    return@repeat
                }
                // Non-eligible legacy/script types remain in allInputOutpoints but do not enter
                // the BIP-352 input public-key sum.
            }
        }

        val outputs = ArrayList<TaprootOutput>()
        var taprootOutputCount = 0
        repeat(vout.length()) { outputIndex ->
            val output = vout.optJSONObject(outputIndex) ?: skip("MALFORMED_OUTPUT")
            val script = scriptHex(output, "scriptpubkey")
            if (!isP2Tr(script)) return@repeat
            taprootOutputCount++
            if (taprootOutputCount > SilentPaymentCodec.MAX_TAPROOT_OUTPUTS) {
                skip("RESOURCE_LIMIT")
            }
            val value = requiredUInt64(output, "value")
            if (value > MAX_MONEY_SAT) skip("INVALID_VALUE")
            val status = output.optJSONObject("status")
            val unspent = optionalBoolean(output, "is_unspent")
                ?: status?.let { optionalBoolean(it, "is_unspent") }
            val spent = optionalBoolean(output, "spent")
                ?: status?.let { optionalBoolean(it, "spent") }
            if (unspent != null && spent != null && unspent == spent) {
                skip("CONFLICTING_SPENTNESS")
            }
            val spentFlag = spent ?: unspent?.not()
            outputs += TaprootOutput(
                outputKey = script.copyOfRange(2, 34),
                outpoint = OutPoint(txidLittleEndian, outputIndex.toLong()),
                valueSat = value,
                // The binary protocol requires a boolean, but an absent Esplora spentness field
                // is not evidence of unspentness. Persisted truth is carried separately by
                // [spentnessKnown] and remains UNKNOWN when this fallback is used.
                isUnspent = spentFlag == true,
                spentnessKnown = spentFlag != null,
            )
        }
        if (outputs.isEmpty()) skip("NO_TAPROOT_OUTPUTS")
        if (eligibleInputs.isEmpty()) skip("NO_ELIGIBLE_INPUTS")

        return SilentPaymentTransaction(
            transactionIdLittleEndian = txidLittleEndian,
            blockHeight = blockHeight,
            transactionIndex = transactionIndex,
            allInputOutpoints = allInputOutpoints,
            eligibleInputs = eligibleInputs,
            outputs = outputs,
        )
    }

    private fun classifyWitnessProgram(script: ByteArray): Int? {
        if (script.isEmpty()) return null
        val opcode = script[0].toInt() and 0xff
        val version = when {
            opcode == 0 -> 0
            opcode in 0x51..0x60 -> opcode - 0x50
            else -> return null
        }
        if (script.size < 2) skip("MALFORMED_WITNESS_PROGRAM")
        val programLength = script[1].toInt() and 0xff
        if (programLength !in 2..40 || script.size != programLength + 2) {
            skip("MALFORMED_WITNESS_PROGRAM")
        }
        if (version == 0 && programLength != 20 && programLength != 32) {
            skip("MALFORMED_WITNESS_PROGRAM")
        }
        if (version == 1 && programLength != 32) {
            skip("MALFORMED_WITNESS_PROGRAM")
        }
        return version
    }

    private fun isP2PKH(script: ByteArray): Boolean =
        script.size == 25 && script[0] == 0x76.toByte() && script[1] == 0xa9.toByte()
            && script[2] == 0x14.toByte() && script[23] == 0x88.toByte()
            && script[24] == 0xac.toByte()

    private fun isP2Sh(script: ByteArray): Boolean =
        script.size == 23 && script[0] == 0xa9.toByte() && script[1] == 0x14.toByte()
            && script[22] == 0x87.toByte()

    private fun isP2Wpkh(script: ByteArray): Boolean =
        script.size == 22 && script[0] == 0.toByte() && script[1] == 0x14.toByte()

    private fun isP2Tr(script: ByteArray): Boolean =
        script.size == 34 && script[0] == 0x51.toByte() && script[1] == 0x20.toByte()

    private fun hash160(value: ByteArray): ByteArray =
        ripemd160(MessageDigest.getInstance("SHA-256").digest(value))

    /** Small dependency-free RIPEMD-160 implementation for public script commitment checks. */
    private fun ripemd160(input: ByteArray): ByteArray {
        val bitLength = input.size.toLong() * 8L
        val paddedLength = ((input.size + 9 + 63) / 64) * 64
        val message = ByteArray(paddedLength)
        input.copyInto(message)
        message[input.size] = 0x80.toByte()
        repeat(8) { index ->
            message[paddedLength - 8 + index] = (bitLength ushr (index * 8)).toByte()
        }

        var h0 = 0x67452301
        var h1 = 0xefcdab89.toInt()
        var h2 = 0x98badcfe.toInt()
        var h3 = 0x10325476
        var h4 = 0xc3d2e1f0.toInt()

        for (offset in message.indices step 64) {
            val words = IntArray(16)
            repeat(16) { index ->
                val base = offset + index * 4
                words[index] = (message[base].toInt() and 0xff) or
                    ((message[base + 1].toInt() and 0xff) shl 8) or
                    ((message[base + 2].toInt() and 0xff) shl 16) or
                    ((message[base + 3].toInt() and 0xff) shl 24)
            }

            var al = h0
            var bl = h1
            var cl = h2
            var dl = h3
            var el = h4
            var ar = h0
            var br = h1
            var cr = h2
            var dr = h3
            var er = h4

            repeat(80) { round ->
                val left = Integer.rotateLeft(
                    al + ripemdFunction(round, bl, cl, dl) + words[RIPEMD_R_LEFT[round]]
                        + RIPEMD_K_LEFT[round / 16],
                    RIPEMD_S_LEFT[round],
                ) + el
                al = el
                el = dl
                dl = Integer.rotateLeft(cl, 10)
                cl = bl
                bl = left

                val right = Integer.rotateLeft(
                    ar + ripemdFunction(79 - round, br, cr, dr) + words[RIPEMD_R_RIGHT[round]]
                        + RIPEMD_K_RIGHT[round / 16],
                    RIPEMD_S_RIGHT[round],
                ) + er
                ar = er
                er = dr
                dr = Integer.rotateLeft(cr, 10)
                cr = br
                br = right
            }

            val temp = h1 + cl + dr
            h1 = h2 + dl + er
            h2 = h3 + el + ar
            h3 = h4 + al + br
            h4 = h0 + bl + cr
            h0 = temp
        }

        val digest = ByteArray(20)
        val words = intArrayOf(h0, h1, h2, h3, h4)
        repeat(words.size) { index ->
            repeat(4) { byteIndex ->
                digest[index * 4 + byteIndex] = (words[index] ushr (byteIndex * 8)).toByte()
            }
        }
        return digest
    }

    private fun ripemdFunction(round: Int, x: Int, y: Int, z: Int): Int = when {
        round < 16 -> x xor y xor z
        round < 32 -> (x and y) or (x.inv() and z)
        round < 48 -> (x or y.inv()) xor z
        round < 64 -> (x and z) or (y and z.inv())
        else -> x xor (y or z.inv())
    }

    private fun parseP2pkhPublicKey(scriptSig: ByteArray, expectedHash: ByteArray): ByteArray {
        // BIP-352 intentionally permits non-standard P2PKH scriptSigs. Walk the script and
        // inspect pushes while tolerating opcodes such as OP_DROP; do not require the usual
        // two-push signature/public-key template.
        var position = 0
        while (position < scriptSig.size) {
            val opcode = scriptSig[position++].toInt() and 0xff
            val length = when (opcode) {
                0 -> 0
                in 1..75 -> opcode
                0x4c -> {
                    if (position >= scriptSig.size) skip("MALFORMED_SCRIPTSIG")
                    scriptSig[position++].toInt() and 0xff
                }
                0x4d -> {
                    if (position + 2 > scriptSig.size) skip("MALFORMED_SCRIPTSIG")
                    val value = (scriptSig[position].toInt() and 0xff) or
                        ((scriptSig[position + 1].toInt() and 0xff) shl 8)
                    position += 2
                    value
                }
                0x4e -> {
                    if (position + 4 > scriptSig.size) skip("MALFORMED_SCRIPTSIG")
                    val value = (scriptSig[position].toInt() and 0xff) or
                        ((scriptSig[position + 1].toInt() and 0xff) shl 8) or
                        ((scriptSig[position + 2].toInt() and 0xff) shl 16) or
                        ((scriptSig[position + 3].toInt() and 0xff) shl 24)
                    position += 4
                    value
                }
                else -> continue
            }
            if (length < 0 || length > MAX_SCRIPTSIG_PUSH_BYTES || position + length > scriptSig.size) {
                skip("MALFORMED_SCRIPTSIG")
            }
            val pushed = scriptSig.copyOfRange(position, position + length)
            if (pushed.size == 33 && isCompressedKey(pushed)
                && hash160(pushed).contentEquals(expectedHash)
            ) {
                return pushed
            }
            position += length
        }
        skip("MALFORMED_P2PKH_PUBKEY")
    }

    private fun parseWitnessPublicKey(input: JSONObject, expectedHash: ByteArray): ByteArray {
        val witness = input.optJSONArray("witness") ?: skip("MISSING_WITNESS")
        if (witness.length() != 2) skip("MALFORMED_WITNESS")
        val encodedSignature = witness.opt(0)
        if (encodedSignature !is String || encodedSignature.isEmpty()) {
            skip("MALFORMED_WITNESS")
        }
        hexToBytesAtMost(encodedSignature, MAX_WITNESS_ITEM_BYTES)
        val encodedKey = witness.opt(1)
        if (encodedKey !is String) skip("MALFORMED_WITNESS_PUBKEY")
        val key = hexToBytes(encodedKey, 33)
        if (!isCompressedKey(key)) skip("MALFORMED_WITNESS_PUBKEY")
        if (!hash160(key).contentEquals(expectedHash)) skip("MALFORMED_WITNESS_PUBKEY")
        return key
    }

    private fun parseSinglePushOrNull(scriptSig: ByteArray): ByteArray? {
        val pushes = runCatching { parsePushOnly(scriptSig) }.getOrNull() ?: return null
        return pushes.singleOrNull()
    }

    private fun parsePushOnly(script: ByteArray): List<ByteArray> {
        val result = ArrayList<ByteArray>()
        var position = 0
        while (position < script.size) {
            val opcode = script[position++].toInt() and 0xff
            val length = when (opcode) {
                0 -> 0
                in 1..75 -> opcode
                0x4c -> {
                    if (position >= script.size) skip("MALFORMED_SCRIPTSIG")
                    script[position++].toInt() and 0xff
                }
                0x4d -> {
                    if (position + 2 > script.size) skip("MALFORMED_SCRIPTSIG")
                    val value = (script[position].toInt() and 0xff) or
                        ((script[position + 1].toInt() and 0xff) shl 8)
                    position += 2
                    value
                }
                else -> skip("NON_PUSH_SCRIPTSIG")
            }
            if (length > 80 || position + length > script.size) skip("MALFORMED_SCRIPTSIG")
            result += script.copyOfRange(position, position + length)
            position += length
        }
        return result
    }

    private fun scriptSigHex(input: JSONObject): ByteArray {
        val direct = (input.opt("scriptsig") as? String).orEmpty()
        if (direct.isNotEmpty()) return hexToBytesAtMost(direct, MAX_SCRIPTSIG_BYTES)
        val nested = input.optJSONObject("scriptSig")?.opt("hex") as? String ?: ""
        return hexToBytesAtMost(nested, MAX_SCRIPTSIG_BYTES)
    }

    private fun scriptHex(obj: JSONObject, key: String): ByteArray {
        val direct = obj.opt(key) as? String ?: ""
        if (direct.isNotEmpty()) return hexToBytesAtMost(direct, MAX_SCRIPT_BYTES)
        val nested = obj.optJSONObject("scriptPubKey")?.opt("hex") as? String ?: ""
        return hexToBytesAtMost(nested, MAX_SCRIPT_BYTES)
    }

    private fun requiredString(obj: JSONObject, key: String, maxLength: Int): String {
        val value = obj.opt(key)
        if (value !is String || value.isEmpty() || value.length > maxLength) {
            skip("MALFORMED_${key.uppercase()}")
        }
        return value
    }

    private fun requiredUInt32(obj: JSONObject, key: String): Long =
        requiredUInt64(obj, key).takeIf { it <= 0xffff_ffffL } ?: skip("INVALID_$key")

    private fun requiredUInt64(obj: JSONObject, key: String): Long = when (val value = obj.opt(key)) {
        is Int -> value.toLong().takeIf { it >= 0 }
        is Long -> value.takeIf { it >= 0 }
        is String -> value.toLongOrNull()?.takeIf { it >= 0 }
        else -> null
    } ?: skip("MISSING_$key")

    private fun optionalBoolean(obj: JSONObject, key: String): Boolean? {
        if (!obj.has(key) || obj.isNull(key)) return null
        return when (val value = obj.opt(key)) {
            is Boolean -> value
            else -> skip("MALFORMED_$key")
        }
    }

    private fun hexToBytes(value: String, expectedBytes: Int): ByteArray {
        if (value.length != expectedBytes * 2 || value.length > 20_000 || value.any { !it.isHexDigit() }) {
            skip("INVALID_HEX")
        }
        return ByteArray(expectedBytes) { index ->
            ((value[index * 2].hexValue() shl 4) or value[index * 2 + 1].hexValue()).toByte()
        }
    }

    private fun hexToBytesAtMost(value: String, maxBytes: Int): ByteArray {
        if (value.isEmpty() || value.length % 2 != 0 || value.length > maxBytes * 2
            || value.any { !it.isHexDigit() }
        ) {
            skip("INVALID_HEX")
        }
        return ByteArray(value.length / 2) { index ->
            ((value[index * 2].hexValue() shl 4) or value[index * 2 + 1].hexValue()).toByte()
        }
    }

    private enum class TaprootInputEligibility {
        ELIGIBLE,
        NUMS_SCRIPT_PATH,
        MALFORMED,
    }

    private fun taprootInputEligibility(input: JSONObject): TaprootInputEligibility {
        val witness = input.optJSONArray("witness") ?: return TaprootInputEligibility.MALFORMED
        if (witness.length() == 0) return TaprootInputEligibility.MALFORMED
        val witnessItems = ArrayList<ByteArray>(witness.length())
        repeat(witness.length()) { index ->
            val encoded = witness.opt(index)
            if (encoded !is String || encoded.isEmpty()) {
                return TaprootInputEligibility.MALFORMED
            }
            val item = runCatching {
                hexToBytesAtMost(encoded, MAX_TAPROOT_CONTROL_BLOCK_BYTES)
            }.getOrNull() ?: return TaprootInputEligibility.MALFORMED
            witnessItems += item
        }

        // BIP-341 annexes are optional and are identified only by the final witness item.
        if (witnessItems.lastOrNull()?.firstOrNull()?.toInt()?.and(0xff) == 0x50) {
            witnessItems.removeAt(witnessItems.lastIndex)
        }
        if (witnessItems.isEmpty()) return TaprootInputEligibility.MALFORMED
        if (witnessItems.size == 1) {
            return if (witnessItems[0].size in 64..65) {
                TaprootInputEligibility.ELIGIBLE
            } else {
                TaprootInputEligibility.MALFORMED
            }
        }

        val controlBlock = witnessItems.last()
        if (controlBlock.size < 33 || (controlBlock.size - 33) % 32 != 0) {
            return TaprootInputEligibility.MALFORMED
        }
        return if (controlBlock.copyOfRange(1, 33).contentEquals(NUMS_INTERNAL_KEY_X)) {
            TaprootInputEligibility.NUMS_SCRIPT_PATH
        } else {
            TaprootInputEligibility.ELIGIBLE
        }
    }

    private fun isCompressedKey(key: ByteArray): Boolean =
        key.size == 33 && ((key[0].toInt() and 0xff) == 0x02 || (key[0].toInt() and 0xff) == 0x03)

    private fun outpointKey(outpoint: OutPoint): String =
        outpoint.txidLittleEndian.joinToString("") { "%02x".format(it.toInt() and 0xff) } + ":" + outpoint.vout

    private fun Char.isHexDigit(): Boolean = this in '0'..'9' || this in 'a'..'f' || this in 'A'..'F'
    private fun Char.hexValue(): Int = when (this) {
        in '0'..'9' -> code - '0'.code
        in 'a'..'f' -> code - 'a'.code + 10
        in 'A'..'F' -> code - 'A'.code + 10
        else -> 0
    }

    private fun skip(reason: String): Nothing = throw EsploraTransactionParseException(reason)

    private companion object {
        const val MAX_SCRIPTSIG_BYTES = 1_650
        const val MAX_SCRIPTSIG_PUSH_BYTES = 1_650
        const val MAX_SCRIPT_BYTES = 10_000
        const val MAX_WITNESS_ITEM_BYTES = 4_129
        const val MAX_TAPROOT_CONTROL_BLOCK_BYTES = 4_129
        val RIPEMD_R_LEFT = intArrayOf(
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
            7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
            3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
            1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
            4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
        )
        val RIPEMD_R_RIGHT = intArrayOf(
            5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
            6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
            15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
            8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
            12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
        )
        val RIPEMD_S_LEFT = intArrayOf(
            11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
            7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
            11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
            11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
            9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
        )
        val RIPEMD_S_RIGHT = intArrayOf(
            8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
            9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
            9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
            15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
            8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
        )
        val RIPEMD_K_LEFT = intArrayOf(
            0x00000000,
            0x5a827999,
            0x6ed9eba1,
            0x8f1bbcdc.toInt(),
            0xa953fd4e.toInt(),
        )
        val RIPEMD_K_RIGHT = intArrayOf(
            0x50a28be6.toInt(),
            0x5c4dd124.toInt(),
            0x6d703ef3.toInt(),
            0x7a6d76e9.toInt(),
            0x00000000,
        )
        val NUMS_INTERNAL_KEY_X: ByteArray =
            hexToBytesConstant("50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0")

        private fun hexToBytesConstant(value: String): ByteArray =
            ByteArray(value.length / 2) { index ->
                ((value[index * 2].digitToInt(16) shl 4) or value[index * 2 + 1].digitToInt(16)).toByte()
            }
    }

    private fun ByteArray.toHexKey(): String =
        joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
}
