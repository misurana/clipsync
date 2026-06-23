package com.clipsync.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.clipsync.R
import com.clipsync.pairing.PairingManager

/**
 * ClipSync Setup Activity
 * Displays the QR code for pairing and guides the user to enable the keyboard.
 */
class SetupActivity : AppCompatActivity() {

    private lateinit var pairingManager: PairingManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        pairingManager = PairingManager(this)

        val ivQr        = findViewById<ImageView>(R.id.iv_qr_code)
        val tvRoomId    = findViewById<TextView>(R.id.tv_room_id)
        val btnEnable   = findViewById<Button>(R.id.btn_enable_keyboard)
        val btnRegenerate = findViewById<Button>(R.id.btn_regenerate)

        // Generate (or re-use) pairing
        val qrBitmap = if (pairingManager.isPaired) {
            pairingManager.getQrBitmap()
        } else {
            pairingManager.generatePairing()
        }

        ivQr.setImageBitmap(qrBitmap)
        tvRoomId.text = "Room ID: ${pairingManager.roomId}"

        // Open IME settings so user can enable ClipSync keyboard
        btnEnable.setOnClickListener {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        }

        // Re-generate pairing (new room ID + new key)
        btnRegenerate.setOnClickListener {
            val newBitmap = pairingManager.generatePairing()
            ivQr.setImageBitmap(newBitmap)
            tvRoomId.text = "Room ID: ${pairingManager.roomId}"
        }
    }

    override fun onResume() {
        super.onResume()
        // Check if ClipSync is already the active IME
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        val enabledMethods = imm.enabledInputMethodList
        val isEnabled = enabledMethods.any { it.packageName == packageName }
        findViewById<Button>(R.id.btn_enable_keyboard).text =
            if (isEnabled) "✓ Keyboard Enabled" else "Enable ClipSync Keyboard"
    }
}
