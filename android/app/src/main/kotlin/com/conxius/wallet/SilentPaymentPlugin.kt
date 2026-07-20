package com.conxius.wallet

import com.conxius.wallet.bitcoin.NativeErrorCode
import com.conxius.wallet.bitcoin.NativeSilentPaymentException
import com.conxius.wallet.bitcoin.SilentPaymentCursor
import com.conxius.wallet.bitcoin.SilentPaymentNetwork
import com.conxius.wallet.bitcoin.SilentPaymentPublicScanReport
import com.conxius.wallet.bitcoin.SilentPaymentScanOptions
import com.conxius.wallet.scan.SilentPaymentScanState
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
* Secret-free Capacitor entry point. Android owns endpoint access, cursor/resume, seed borrowing,
* native scanning, and persistence; JavaScript receives only public UTXOs and bounded metrics.
*
* The shipped launcher is a native Compose [androidx.fragment.app.FragmentActivity], not a
* Capacitor [com.getcapacitor.BridgeActivity]. This class is therefore an explicit bridge
* component for a future Capacitor host and is not reachable from the current launcher. The
* generated Capacitor plugin asset intentionally does not claim registration for this class.
*/
@CapacitorPlugin(name = "SilentPayment")
class SilentPaymentPlugin : Plugin() {
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @PluginMethod
    fun scanForPayments(call: PluginCall) {
        val data = call.getData()
        val legacySecretFields = listOf(
            "mnemonic", "passphrase", "seed", "scanKey", "spendKey", "privateKey", "xpriv",
        )
        if (legacySecretFields.any(data::has)) {
            rejectStable(call, NativeErrorCode.INVALID_REQUEST)
            return
        }

        val app = activity?.application as? ConxiusApplication
        if (app == null) {
            rejectStable(call, NativeErrorCode.INTERNAL)
            return
        }
        val network = parseNetwork(call.getString("network"))
        if (network == null) {
            rejectStable(call, NativeErrorCode.INVALID_NETWORK)
            return
        }
        val endHeight = readHeight(data, "endHeight")
        if (endHeight == null) {
            rejectStable(call, NativeErrorCode.INVALID_REQUEST)
            return
        }
        val hasStartHeight = data.has("startHeight") && !data.isNull("startHeight")
        val startHeight = if (hasStartHeight) {
            readHeight(data, "startHeight")
        } else {
            null
        }
        if (hasStartHeight && startHeight == null) {
            rejectStable(call, NativeErrorCode.INVALID_REQUEST)
            return
        }

        val deferred = try {
            app.silentPaymentCoordinator.start(
                SilentPaymentScanOptions(network, startHeight, endHeight),
            )
        } catch (error: NativeSilentPaymentException) {
            rejectStable(call, error.code)
            return
        } catch (_: IllegalArgumentException) {
            rejectStable(call, NativeErrorCode.INVALID_REQUEST)
            return
        }
        pluginScope.launch {
            try {
                call.resolve(reportToJs(deferred.await()))
            } catch (_: CancellationException) {
                rejectStable(call, NativeErrorCode.CANCELLED)
            } catch (error: NativeSilentPaymentException) {
                rejectStable(call, error.code)
            } catch (_: Exception) {
                rejectStable(call, NativeErrorCode.INTERNAL)
            }
        }
    }

    @PluginMethod
    fun cancelScan(call: PluginCall) {
        val app = activity?.application as? ConxiusApplication
        if (app == null) {
            rejectStable(call, NativeErrorCode.INTERNAL)
            return
        }
        app.silentPaymentCoordinator.cancel()
        call.resolve(statusToJs(app.silentPaymentCoordinator.state.value))
    }

    @PluginMethod
    fun getScanStatus(call: PluginCall) {
        val app = activity?.application as? ConxiusApplication
        if (app == null) {
            rejectStable(call, NativeErrorCode.INTERNAL)
            return
        }
        call.resolve(statusToJs(app.silentPaymentCoordinator.state.value))
    }

    override fun handleOnDestroy() {
        pluginScope.cancel()
        (activity?.application as? ConxiusApplication)?.silentPaymentCoordinator?.cancel()
        super.handleOnDestroy()
    }

    private fun parseNetwork(value: String?): SilentPaymentNetwork? =
        value?.trim()?.uppercase()?.let { normalized ->
            runCatching { SilentPaymentNetwork.valueOf(normalized) }.getOrNull()
        }

    /** JSONObject coercion is permissive; accept only finite, integral, non-negative numbers. */
    private fun readHeight(data: JSObject, key: String): Long? {
        if (!data.has(key) || data.isNull(key)) return null
        val value = data.opt(key)
        return when (value) {
            is Int -> value.toLong().takeIf { it >= 0 }
            is Long -> value.takeIf { it in 0..MAX_SAFE_JS_INTEGER }
            is Double -> if (value.isFinite() && value >= 0.0 && value % 1.0 == 0.0
                && value <= MAX_SAFE_JS_INTEGER.toDouble()
            ) {
                value.toLong()
            } else {
                null
            }
            else -> null
        }
    }

    private companion object {
        const val MAX_SAFE_JS_INTEGER = 9_007_199_254_740_991L
    }

    private fun rejectStable(call: PluginCall, code: NativeErrorCode) {
        call.reject(code.name, code.name)
    }

    private fun reportToJs(report: SilentPaymentPublicScanReport): JSObject = JSObject().apply {
        put("utxos", JSArray().also { array ->
            report.utxos.forEach { utxo ->
                array.put(JSObject().apply {
                    put("network", utxo.network.name.lowercase())
                    put("outpoint", utxo.outpoint)
                    put("txid", utxo.txid)
                    put("vout", utxo.vout)
                    put("valueSat", utxo.valueSat)
                    put("outputKeyHex", utxo.outputKeyHex)
                    put("blockHeight", utxo.blockHeight)
                    put("transactionIndex", utxo.transactionIndex)
                    put("source", utxo.source)
                    put("spentState", utxo.spentState)
                    put("spentnessKnown", utxo.spentnessKnown)
                    put("matchKind", utxo.matchKind)
                    utxo.labelIndex?.let { label -> put("labelIndex", label) }
                    put("matchedNegatedOutputKey", utxo.matchedNegatedOutputKey)
                })
            }
        })
        put("metrics", JSObject().apply {
            put("scannedBlocks", report.metrics.scannedBlocks)
            put("scannedTransactions", report.metrics.scannedTransactions)
            put("skippedTransactions", report.metrics.skippedTransactions)
            put("matchCount", report.metrics.matchCount)
            report.metrics.currentHeight?.let { put("currentHeight", it) }
            report.metrics.currentTipHeight?.let { put("currentTipHeight", it) }
        })
        report.cursor?.let { put("cursor", cursorToJs(it)) }
    }

    private fun cursorToJs(cursor: SilentPaymentCursor): JSObject = JSObject().apply {
        put("network", cursor.network.name.lowercase())
        put("lastScannedHeight", cursor.lastScannedHeight)
        put("lastScannedBlockHash", cursor.lastScannedBlockHash)
    }

    private fun statusToJs(state: SilentPaymentScanState): JSObject = JSObject().apply {
        when (state) {
            SilentPaymentScanState.Idle -> put("status", "idle")
            is SilentPaymentScanState.Scanning -> {
                put("status", "scanning")
                put("progress", JSObject().apply {
                    put("startHeight", state.progress.startHeight)
                    put("endHeight", state.progress.endHeight)
                    state.progress.currentHeight?.let { put("currentHeight", it) }
                    put("scannedBlocks", state.progress.scannedBlocks)
                    put("scannedTransactions", state.progress.scannedTransactions)
                    put("skippedTransactions", state.progress.skippedTransactions)
                    put("matchCount", state.progress.matchCount)
                    state.progress.currentTipHeight?.let { put("currentTipHeight", it) }
                })
            }
            is SilentPaymentScanState.Completed -> {
                put("status", "completed")
                putReportFields(state.report)
            }
            is SilentPaymentScanState.Failed -> {
                put("status", "failed")
                put("errorCode", state.code.name)
            }
            SilentPaymentScanState.Cancelled -> {
                put("status", "cancelled")
                put("errorCode", NativeErrorCode.CANCELLED.name)
            }
        }
    }

    private fun JSObject.putReportFields(report: SilentPaymentPublicScanReport) {
        val encoded = reportToJs(report)
        put("utxos", encoded.getJSONArray("utxos"))
        put("metrics", encoded.getJSObject("metrics"))
        if (!encoded.isNull("cursor")) {
            encoded.getJSObject("cursor")?.let { put("cursor", it) }
        }
    }
}
