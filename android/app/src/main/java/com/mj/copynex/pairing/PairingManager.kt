package com.mj.copynex.pairing

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * ClipSync Pairing Manager — NEW FLOW
 * Web app generates the QR. Android scans it and stores room + key.
 */
class PairingManager(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson  = Gson()

    companion object {
        private const val PREFS_NAME   = "clipsync_prefs"
        private const val KEY_ROOM_ID  = "roomId"
        private const val KEY_ENC_KEY  = "encKey"
        private const val KEY_FB_CONFIG = "fbConfig"
    }

    /** True if this device has already been paired. */
    val isPaired: Boolean
        get() = prefs.contains(KEY_ROOM_ID) && prefs.contains(KEY_ENC_KEY)

    val roomId: String?
        get() = prefs.getString(KEY_ROOM_ID, null)

    val encKeyBase64: String?
        get() = prefs.getString(KEY_ENC_KEY, null)

    val firebaseConfig: Map<String, String>?
        get() {
            val json = prefs.getString(KEY_FB_CONFIG, null) ?: return null
            val type = object : TypeToken<Map<String, String>>() {}.type
            return gson.fromJson(json, type)
        }

    /**
     * Called after the QR code is scanned.
     * Parses JSON payload and persists room ID, key, and Firebase config.
     *
     * Expected QR JSON format:
     * { "room": "abc12345", "key": "<base64-256bit>", "fbConfig": { ... } }
     *
     * @return true on success, false if QR data is invalid
     */
    fun onQrScanned(qrContent: String): Boolean {
        return try {
            val type = object : TypeToken<Map<String, Any>>() {}.type
            val parsed: Map<String, Any> = gson.fromJson(qrContent, type)

            val room     = parsed["room"] as? String ?: return false
            val key      = parsed["key"]  as? String ?: return false
            @Suppress("UNCHECKED_CAST")
            val fbConfig = parsed["fbConfig"] as? Map<String, String> ?: return false

            prefs.edit()
                .putString(KEY_ROOM_ID,   room)
                .putString(KEY_ENC_KEY,   key)
                .putString(KEY_FB_CONFIG, gson.toJson(fbConfig))
                .apply()

            true
        } catch (e: Exception) {
            android.util.Log.e("ClipSync", "QR parse failed: ${e.message}")
            false
        }
    }

    /** Clear all stored pairing data. */
    fun clearPairing() {
        prefs.edit()
            .remove(KEY_ROOM_ID)
            .remove(KEY_ENC_KEY)
            .remove(KEY_FB_CONFIG)
            .apply()
    }
}
