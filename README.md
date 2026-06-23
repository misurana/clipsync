# ClipSync

> **Cross-device clipboard sync — wherever you are in the world.**

ClipSync is an Android custom keyboard + Vercel web app that silently syncs your clipboard between your phone and laptop. All data is **end-to-end encrypted** with AES-256-GCM. Firebase never sees your text.

---

## How It Works

```
+----------------+       Firebase RTDB          +------------------+
| Android Device |   (encrypted payloads)        | Laptop (Browser) |
| +------------+ |    rooms/{roomId}/            | +--------------+ |
| | Keyboard   | | <===========================> | | Vercel Web   | |
| | (IME)      | |        clipboard              | | App (JS)     | |
| +------------+ |                               | +--------------+ |
+----------------+                               +------------------+
```

1. **Copy on Android** → keyboard encrypts → pushes to Firebase
2. **Web app** receives → decrypts → shows "Copy to Laptop Clipboard" button
3. **Type on laptop** → click "Send to Phone" → encrypts → pushes to Firebase
4. **Android keyboard** receives → "Paste from Laptop" key inserts text instantly

---

## Security

- **AES-256-GCM** encryption — every message gets a fresh 12-byte IV
- **Key exchange via QR code only** — the encryption key never travels over the network
- Firebase stores only ciphertext — meaningless without the key
- No accounts, no tracking, no analytics

---

## Repository Structure

```
clipsync/
├── android/                    # Android keyboard IME (Kotlin)
│   └── app/src/main/java/com/clipsync/
│       ├── keyboard/           # IME service, keyboard view
│       ├── sync/               # Firebase helper, encryption, clipboard listener
│       ├── pairing/            # QR generator, key management
│       └── ui/                 # Setup activity, settings
├── web/                        # Static web app (Vercel)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── crypto.js
│   ├── firebase.js
│   └── vercel.json
└── .kiro/specs/clipsync/       # Spec: requirements, design, tasks
```

---

## Setup

### Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create project
2. Enable **Realtime Database** (not Firestore)
3. Set security rules:
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "clipboard": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
```
4. Copy your project config (see `web/firebase-config.example.js`)

### Web App (Vercel)

```bash
cd web
npx vercel deploy
```

Or connect the GitHub repo to Vercel for automatic deployments.

### Android App

1. Open `android/` in Android Studio
2. Add your `google-services.json` from Firebase Console
3. Build & install on your device
4. Set ClipSync as your default keyboard: Settings → General Management → Keyboard
5. Open ClipSync setup → tap "Show QR Code"
6. Scan with the web app

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Android keyboard | Kotlin, InputMethodService |
| Android encryption | javax.crypto AES/GCM/NoPadding |
| Android async | Kotlin Coroutines |
| QR generation (Android) | ZXing Embedded |
| Web app | Vanilla JS (ES modules) |
| Web encryption | Web Crypto API (crypto.subtle) |
| QR scanning (web) | html5-qrcode |
| Database | Firebase Realtime Database |
| Hosting | Vercel |

---

## Development Phases

| Phase | Description |
|-------|-------------|
| **Phase 0** | Firebase setup + Android PoC (plain app) + Web PoC |
| **Phase 1** | QR pairing, Vercel deployment, stable E2E encryption |
| **Phase 2** | Full keyboard IME with toolbar + clipboard listener + paste action |
| **Phase 3** | Polish, error handling, duplicate detection, beta testing |

---

## License

MIT
