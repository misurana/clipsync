package com.clipsync.pairing

import android.content.Context
import android.graphics.Bitmap
import com.clipsync.sync.CryptoHelper
import com.google.gson.Gson
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/**
 * ClipSync Pairing Manager
 * Generates / persists Room ID + encryption key, and creates the QR code bitmap.
 */
class PairingManager(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson  = Gson()

    companion object {
        private const val PREFS_NAME  = "clipsync_prefs"
        private const val KEY_ROOM_ID = "roomId"
        private const val KEY_ENC_KEY = "encKey"

        /** Firebase project config — replace with real values from Firebase Console */
        private val FIREBASE_CONFIG = mapOf(
            "apiKey"            to "YOUR_API_KEY",
            "authDomain"        to "YOUR_PROJECT_ID.firebaseapp.com",
            "databaseURL"       to "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
            "projectId"         to "YOUR_PROJECT_ID",
            "storageBucket"     to "YOUR_PROJECT_ID.appspot.com",
            "messagingSenderId" to "YOUR_SENDER_ID",
            "appId"             to "YOUR_APP_ID"
        )
    }

    /** True if this device has already been paired (room ID + key exist). */
    val isPaired: Boolean
        get() = prefs.contains(KEY_ROOM_ID) && prefs.contains(KEY_ENC_KEY)

    /** Current Room ID, or null if not paired. */
    val roomId: String?
        get() = prefs.getString(KEY_ROOM_ID, null)

    /** Current base64-encoded encryption key, or null if not paired. */
    val encKeyBase64: String?
        get() = prefs.getString(KEY_ENC_KEY, null)

    /**
     * Generate a new Room ID and AES-256 key, persist them, and return the QR bitmap.
     * Safe to call multiple times — re-generates if called again.
     */
    fun generatePairing(qrSizePx: Int = 512): Bitmap {
        val newRoomId = generateRoomId()
        val newKey    = CryptoHelper.generateKey()
        val base64Key = CryptoHelper.keyToBase64(newKey)

        prefs.edit()
            .putString(KEY_ROOM_ID, newRoomId)
            .putString(KEY_ENC_KEY, base64Key)
            .apply()

        return buildQrBitmap(newRoomId, base64Key, qrSizePx)
    }

    /**
     * Build the QR bitmap using saved pairing info (call after [generatePairing]).
     */
    fun getQrBitmap(qrSizePx: Int = 512): Bitmap? {
        val id  = roomId    ?: return null
        val key = encKeyBase64 ?: return null
        return buildQrBitmap(id, key, qrSizePx)
    }

    /** Clear all stored pairing data. */
    fun clearPairing() {
        prefs.edit().remove(KEY_ROOM_ID).remove(KEY_ENC_KEY).apply()
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private fun generateRoomId(): String {
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        return (1..8).map { chars.random() }.joinToString("")
    }

    private fun buildQrBitmap(roomId: String, base64Key: String, sizePx: Int): Bitmap {
        val qrContent = gson.toJson(
            mapOf(
                "room"     to roomId,
                "key"      to base64Key,
                "fbConfig" to FIREBASE_CONFIG
            )
        )

        val hints = mapOf(EncodeHintType.MARGIN to 1)
        val bitMatrix = QRCodeWriter().encode(
            qrContent,
            BarcodeFormat.QR_CODE,
            sizePx,
            sizePx,
            hints
        )

        val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
        for (x in 0 until sizePx) {
            for (y in 0 until sizePx) {
                bmp.setPixel(x, y, if (bitMatrix[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
            }
        }
        return bmp
    }
}
