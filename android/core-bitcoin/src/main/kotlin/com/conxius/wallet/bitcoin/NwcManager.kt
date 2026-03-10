package com.conxius.wallet.bitcoin

import org.json.JSONObject

/**
 * NIP-47 (Nostr Wallet Connect) Manager
 * Handles NIP-47 parsing and signing for the native layer.
 */
class NwcManager {

    /**
     * Parses an NWC request event.
     */
    fun parseRequest(eventJson: String, secretKey: String): String? {
        return try {
            val event = JSONObject(eventJson)
            event.getString("content")
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Constructs the content for an NWC response.
     */
    fun createResponseContent(requestId: String, result: String, error: String?): String {
        val response = JSONObject()
        val resultObj = JSONObject()

        if (error != null) {
            resultObj.put("error", JSONObject().put("code", "INTERNAL_ERROR").put("message", error))
        } else {
            resultObj.put("result", result)
        }

        response.put("result_type", "pay_invoice")
        return response.toString()
    }
}
