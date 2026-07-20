package com.conxius.wallet

import com.conxius.wallet.bitcoin.SilentPaymentManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "SilentPayment")
class SilentPaymentPlugin : Plugin() {
    private val manager = SilentPaymentManager()

    @PluginMethod
    fun deriveSilentAddress(call: PluginCall) {
        val scanPk = call.getString("scanPk") ?: return call.reject("scanPk required")
        val spendPk = call.getString("spendPk") ?: return call.reject("spendPk required")

        try {
            val address = manager.deriveSilentAddress(scanPk, spendPk)
            val res = JSObject()
            res.put("address", address)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun scanForPayments(call: PluginCall) {
        val scanSk = call.getString("scanSk") ?: return call.reject("scanSk required")
        val spendPk = call.getString("spendPk") ?: return call.reject("spendPk required")
        val startBlock = call.getLong("startBlock") ?: return call.reject("startBlock required")
        val endBlock = call.getLong("endBlock") ?: return call.reject("endBlock required")

        try {
            val utxos = manager.scanForPayments(scanSk, spendPk, startBlock, endBlock)
            val res = JSObject()
            val utxoArray = com.getcapacitor.JSArray()
            utxos.forEach { utxoArray.put(it) }
            res.put("utxos", utxoArray)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }
}
