package com.clipsync.sync

import android.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * ClipSync Crypto Helper
 * AES-256-GCM encryption / decryption.
 * Protocol: 12-byte IV prepended to ciphertext, base64-encoded as the payload.
 */
object CryptoHelper {

    private const val ALGORITHM     = "AES"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_LENGTH_BYTES = 12
    private const val GCM_TAG_BITS    = 128

    /**
     * Generate a new 256-bit AES key.
     */
    fun generateKey(): SecretKey {
        val kg = KeyGenerator.getInstance(ALGORITHM)
        kg.init(256)
        return kg.generateKey()
    }

    /**
     * Convert a base64-encoded key string back to a SecretKey.
     */
    fun keyFromBase64(base64Key: String): SecretKey {
        val keyBytes = Base64.decode(base64Key, Base64.NO_WRAP)
        return SecretKeySpec(keyBytes, ALGORITHM)
    }

    /**
     * Convert a SecretKey to a base64 string for storage.
     */
    fun keyToBase64(key: SecretKey): String =
        Base64.encodeToString(key.encoded, Base64.NO_WRAP)

    /**
     * Encrypt plaintext using AES-256-GCM.
     * @return base64(IV [12 bytes] + ciphertext)
     */
    fun encrypt(plainText: String, key: SecretKey): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv         = cipher.iv                                  // 12 bytes auto-generated
        val ciphertext = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val combined   = iv + ciphertext                            // concatenate
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    /**
     * Decrypt a payload produced by [encrypt].
     * @param payload base64(IV [12 bytes] + ciphertext)
     * @return decrypted plaintext
     */
    fun decrypt(payload: String, key: SecretKey): String {
        val combined   = Base64.decode(payload, Base64.NO_WRAP)
        val iv         = combined.sliceArray(0 until IV_LENGTH_BYTES)
        val ciphertext = combined.sliceArray(IV_LENGTH_BYTES until combined.size)
        val cipher     = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }
}
