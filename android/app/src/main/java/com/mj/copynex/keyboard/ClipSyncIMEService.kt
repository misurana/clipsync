package com.mj.copynex.keyboard

import android.content.ClipboardManager
import android.content.Context
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.TextView
import com.mj.copynex.R
import com.mj.copynex.pairing.PairingManager
import com.mj.copynex.sync.CryptoHelper
import com.mj.copynex.sync.FirebaseHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * ClipSync IME Service
 * Custom keyboard with integrated clipboard sync.
 */
class ClipSyncIMEService : InputMethodService() {

    // ── Coroutine scope tied to the IME lifecycle ────────────────────────────
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // ── Helpers ──────────────────────────────────────────────────────────────
    private lateinit var pairingManager: PairingManager
    private var firebaseHelper: FirebaseHelper? = null

    // ── State ────────────────────────────────────────────────────────────────
    private var lastPushedText:   String? = null  // duplicate detection
    private var pendingPasteText: String? = null  // decrypted text from laptop

    // ── UI refs ──────────────────────────────────────────────────────────────
    private var btnPaste:   Button?   = null
    private var tvStatus:   TextView? = null

    // ── Clipboard listener ───────────────────────────────────────────────────
    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        val cm   = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = cm.primaryClip?.getItemAt(0)?.coerceToText(this)?.toString() ?: return@OnPrimaryClipChangedListener

        // Duplicate detection
        if (text == lastPushedText) return@OnPrimaryClipChangedListener
        lastPushedText = text

        val roomId = pairingManager.roomId ?: return@OnPrimaryClipChangedListener
        val keyB64 = pairingManager.encKeyBase64 ?: return@OnPrimaryClipChangedListener
        val key    = CryptoHelper.keyFromBase64(keyB64)
        val helper = firebaseHelper ?: FirebaseHelper(roomId).also { firebaseHelper = it }

        serviceScope.launch(Dispatchers.IO) {
            try {
                val payload = CryptoHelper.encrypt(text, key)
                helper.push(payload, "android")
                launch(Dispatchers.Main) { setStatus("synced") }
            } catch (e: Exception) {
                android.util.Log.e("ClipSync", "Push failed: ${e.message}")
                launch(Dispatchers.Main) { setStatus("offline") }
            }
        }
        setStatus("syncing")
    }

    // ── IME lifecycle ─────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        pairingManager = PairingManager(this)
        // Initialize Firebase from stored config (scanned from web app QR)
        initFirebaseFromStoredConfig()
    }

    private fun initFirebaseFromStoredConfig() {
        val config = pairingManager.firebaseConfig ?: return
        try {
            if (com.google.firebase.FirebaseApp.getApps(this).none { it.name == "clipsync" }) {
                val options = com.google.firebase.FirebaseOptions.Builder()
                    .setApiKey(config["apiKey"] ?: return)
                    .setDatabaseUrl(config["databaseURL"] ?: return)
                    .setProjectId(config["projectId"] ?: return)
                    .setApplicationId(config["appId"] ?: return)
                    .setStorageBucket(config["storageBucket"])
                    .setGcmSenderId(config["messagingSenderId"])
                    .build()
                com.google.firebase.FirebaseApp.initializeApp(this, options, "clipsync")
            }
        } catch (e: Exception) {
            android.util.Log.e("ClipSync", "Firebase init in IME failed: ${e.message}")
        }
    }

    override fun onCreateInputView(): View {
        val keyboardView = layoutInflater.inflate(R.layout.keyboard_view, null)

        btnPaste = keyboardView.findViewById(R.id.btn_paste_from_laptop)
        tvStatus  = keyboardView.findViewById(R.id.tv_sync_status)

        // Wire up keyboard key click listener
        val keyListener = KeyboardKeyListener(this)
        keyboardView.findViewById<View>(R.id.keyboard_keys_container)
            ?.let { keyListener.attachTo(it) }

        btnPaste?.setOnClickListener { pasteFromLaptop() }
        btnPaste?.isEnabled = false

        // Start Firebase listener for incoming laptop text
        startFirebaseListener()

        return keyboardView
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        registerClipboardListener()
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        unregisterClipboardListener()
    }

    override fun onDestroy() {
        super.onDestroy()
        firebaseHelper?.stopListening()
        serviceScope.cancel()
    }

    // ── Clipboard monitoring ──────────────────────────────────────────────────

    private fun registerClipboardListener() {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.addPrimaryClipChangedListener(clipboardListener)
    }

    private fun unregisterClipboardListener() {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.removePrimaryClipChangedListener(clipboardListener)
    }

    // ── Firebase listen (laptop → phone) ─────────────────────────────────────

    private fun startFirebaseListener() {
        val roomId = pairingManager.roomId ?: return
        val keyB64 = pairingManager.encKeyBase64 ?: return
        val key    = CryptoHelper.keyFromBase64(keyB64)

        val helper = FirebaseHelper(roomId).also { firebaseHelper = it }
        helper.startListening { entry ->
            if (entry.from == "android") return@startListening  // ignore own sends

            serviceScope.launch(Dispatchers.IO) {
                try {
                    val text = CryptoHelper.decrypt(entry.payload, key)
                    launch(Dispatchers.Main) {
                        pendingPasteText = text
                        btnPaste?.isEnabled = true
                    }
                } catch (e: Exception) {
                    android.util.Log.e("ClipSync", "Decrypt failed: ${e.message}")
                }
            }
        }
    }

    // ── Paste action ──────────────────────────────────────────────────────────

    private fun pasteFromLaptop() {
        val text = pendingPasteText ?: return
        currentInputConnection?.commitText(text, 1)
        pendingPasteText = null
        btnPaste?.isEnabled = false
    }

    // ── Status indicator ──────────────────────────────────────────────────────

    private fun setStatus(state: String) {
        tvStatus?.text = when (state) {
            "syncing" -> "⬆ Syncing…"
            "synced"  -> "✓ Synced"
            "offline" -> "✕ Offline"
            else      -> "ClipSync"
        }
    }
}

