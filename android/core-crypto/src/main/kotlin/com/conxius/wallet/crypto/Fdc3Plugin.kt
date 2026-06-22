package com.conxius.wallet.crypto

import android.content.Intent
import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * FDC3 Native Bridge Plugin (CON-1181)
 *
 * Bridges TypeScript fdc3 calls to Native Android Intents.
 */
@CapacitorPlugin(name = "Fdc3")
class Fdc3Plugin : Plugin() {
    private val TAG = "Fdc3Plugin"

    /**
     * Raises an FDC3 intent to be handled by the Android system or specific app.
     */
    @PluginMethod
    fun raiseIntent(call: PluginCall) {
        val intentName = call.getString("intent")
        val fdc3Context = call.getObject("context")

        if (intentName == null || fdc3Context == null) {
            call.reject("Intent name and context are required")
            return
        }

        Log.d(TAG, "Raising FDC3 Intent: $intentName")

        val androidIntent = Intent("com.finos.fdc3.intent.$intentName").apply {
            val type = fdc3Context.getString("type") ?: "fdc3.instrument"
            setDataAndType(null, "application/vnd.$type+json")

            // Map context fields to Extras
            val id = fdc3Context.getJSObject("id")
            id?.keys()?.forEach { key ->
                putExtra(key, id.getString(key))
            }
        }

        try {
            this.context.startActivity(androidIntent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start FDC3 intent activity", e)
            call.reject("No application found to handle intent $intentName")
        }
    }

    /**
     * Broadcasts a context update to other FDC3-aware apps.
     */
    @PluginMethod
    fun broadcast(call: PluginCall) {
        val fdc3Context = call.getObject("context") ?: return call.reject("Context required")

        val broadcastIntent = Intent("com.finos.fdc3.BROADCAST").apply {
            putExtra("fdc3_context", fdc3Context.toString())
        }

        this.context.sendBroadcast(broadcastIntent)
        call.resolve()
    }
}
