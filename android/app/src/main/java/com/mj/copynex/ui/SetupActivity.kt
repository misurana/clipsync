package com.mj.copynex.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.database.FirebaseDatabase
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanIntentResult
import com.journeyapps.barcodescanner.ScanOptions
import com.mj.copynex.R
import com.mj.copynex.pairing.PairingManager

/**
 * SetupActivity — NEW FLOW
 * Shows a "Scan QR Code" button. User scans the QR from the Vercel web app.
 * On success, stores pairing data and prompts user to enable the keyboard.
 */
class SetupActivity : AppCompatActivity() {

    private lateinit var pairingManager: PairingManager

    // ZXing QR scanner launcher
    private val qrScanLauncher = registerForActivityResult(ScanContract()) { result: ScanIntentResult ->
        if (result.contents != null) {
            handleScanResult(result.contents)
        } else {
            Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        pairingManager = PairingManager(this)

        val tvStatus    = findViewById<TextView>(R.id.tv_pairing_status)
        val btnScan     = findViewById<Button>(R.id.btn_scan_qr)
        val btnEnable   = findViewById<Button>(R.id.btn_enable_keyboard)
        val btnClear    = findViewById<Button>(R.id.btn_clear_pairing)

        // Update UI based on current pairing state
        updatePairingStatus(tvStatus, btnScan, btnClear)

        btnScan.setOnClickListener {
            val options = ScanOptions().apply {
                setPrompt("Scan the QR code from clipsync-web-phi.vercel.app")
                setBeepEnabled(true)
                setOrientationLocked(false)
                setBarcodeImageEnabled(false)
            }
            qrScanLauncher.launch(options)
        }

        btnEnable.setOnClickListener {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        }

        btnClear.setOnClickListener {
            pairingManager.clearPairing()
            updatePairingStatus(tvStatus, btnScan, btnClear)
            Toast.makeText(this, "Pairing cleared", Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleScanResult(qrContent: String) {
        val tvStatus = findViewById<TextView>(R.id.tv_pairing_status)
        val btnScan  = findViewById<Button>(R.id.btn_scan_qr)
        val btnClear = findViewById<Button>(R.id.btn_clear_pairing)

        val success = pairingManager.onQrScanned(qrContent)

        if (success) {
            // Initialize Firebase with the scanned config
            initFirebaseFromConfig()
            Toast.makeText(this, "✓ Paired successfully!", Toast.LENGTH_LONG).show()
            updatePairingStatus(tvStatus, btnScan, btnClear)
        } else {
            Toast.makeText(this, "Invalid QR code. Open ClipSync web app and scan that QR.", Toast.LENGTH_LONG).show()
        }
    }

    private fun initFirebaseFromConfig() {
        val config = pairingManager.firebaseConfig ?: return
        try {
            // Only init if not already initialized
            if (FirebaseApp.getApps(this).none { it.name == "clipsync" }) {
                val options = FirebaseOptions.Builder()
                    .setApiKey(config["apiKey"] ?: return)
                    .setDatabaseUrl(config["databaseURL"] ?: return)
                    .setProjectId(config["projectId"] ?: return)
                    .setApplicationId(config["appId"] ?: return)
                    .setStorageBucket(config["storageBucket"])
                    .setGcmSenderId(config["messagingSenderId"])
                    .build()
                FirebaseApp.initializeApp(this, options, "clipsync")
            }
        } catch (e: Exception) {
            android.util.Log.e("ClipSync", "Firebase init failed: ${e.message}")
        }
    }

    private fun updatePairingStatus(tvStatus: TextView, btnScan: Button, btnClear: Button) {
        if (pairingManager.isPaired) {
            tvStatus.text = "✓ Paired — Room: ${pairingManager.roomId}"
            btnScan.text  = "Re-scan QR Code"
            btnClear.isEnabled = true
        } else {
            tvStatus.text = "Not paired yet"
            btnScan.text  = "Scan QR Code"
            btnClear.isEnabled = false
        }
    }
}
