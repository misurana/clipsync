package com.clipsync.sync

import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * ClipSync Firebase Helper
 * Handles push and real-time listen on /rooms/{roomId}/clipboard
 */
class FirebaseHelper(private val roomId: String) {

    private val db        = FirebaseDatabase.getInstance()
    private val clipRef   = db.getReference("rooms/$roomId/clipboard")
    private var listener: ValueEventListener? = null

    data class ClipboardEntry(
        val payload: String = "",
        val ts:      Long   = 0L,
        val from:    String = ""
    )

    /**
     * Push an encrypted clipboard entry to Firebase.
     * Runs on the IO dispatcher so it's safe to call from any coroutine.
     */
    suspend fun push(encryptedPayload: String, from: String = "android") {
        withContext(Dispatchers.IO) {
            val entry = mapOf(
                "payload" to encryptedPayload,
                "ts"      to System.currentTimeMillis(),
                "from"    to from
            )
            // setValue returns a Task; we block until complete
            clipRef.setValue(entry)
        }
    }

    /**
     * Start listening for real-time clipboard updates.
     * [callback] is invoked on every snapshot change.
     * Call [stopListening] to remove the listener.
     */
    fun startListening(callback: (ClipboardEntry) -> Unit) {
        stopListening() // remove stale listener if any

        listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) return
                val entry = snapshot.getValue(ClipboardEntry::class.java) ?: return
                callback(entry)
            }

            override fun onCancelled(error: DatabaseError) {
                // Silently log — keyboard must keep working offline
                android.util.Log.w("ClipSync", "Firebase listen cancelled: ${error.message}")
            }
        }
        clipRef.addValueEventListener(listener!!)
    }

    /**
     * Remove the real-time listener.
     */
    fun stopListening() {
        listener?.let { clipRef.removeEventListener(it) }
        listener = null
    }
}
