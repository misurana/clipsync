# ClipSync – Technical Design

## System Architecture

```
+----------------+       Firebase RTDB          +------------------+
| Android Device |   (encrypted payloads)        | Laptop (Browser) |
| +------------+ |    rooms/{roomId}/            | +--------------+ |
| | Keyboard   | | <===========================> | | Vercel Web   | |
| | (IME)      | |        clipboard              | | App (JS)     | |
| +------------+ |                               | +--------------+ |
+----------------+                               +------------------+
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Android App | Kotlin, Android SDK, Firebase Realtime Database SDK |
| Encryption (Android) | `javax.crypto.Cipher` AES/GCM/NoPadding |
| Keyboard IME | `InputMethodService` |
| Web App | Vanilla JS, Firebase JS SDK (CDN), Web Crypto API |
| QR Scanner (web) | `html5-qrcode` |
| QR Generator (Android) | ZXing Embedded |
| Async (Android) | Kotlin Coroutines |
| Hosting | Vercel (static site) |
| Database | Firebase Realtime Database (free tier) |
| Serialization | Gson (Android) |

---

## Repository Structure (Monorepo)

```
clipsync/
├── android/
│   ├── app/
│   │   ├── src/main/java/com/clipsync/
│   │   │   ├── keyboard/       # IME service, keyboard view
│   │   │   ├── sync/           # Firebase helper, encryption, clipboard listener
│   │   │   ├── pairing/        # QR generator, key management
│   │   │   └── ui/             # Setup activity, settings
│   │   └── res/
│   └── build.gradle.kts
├── web/
│   ├── index.html
│   ├── style.css
│   ├── app.js                  # Firebase init, QR scanner, UI logic
│   ├── crypto.js               # AES-GCM using Web Crypto API
│   └── vercel.json
└── README.md
```

---

## Data Model

### Firebase Realtime Database

```
/rooms/<roomId>/clipboard
  - payload: string    // base64(IV + ciphertext), 12-byte IV prepended
  - ts: number         // epoch milliseconds
  - from: string       // "android" | "web"
```

Single active entry per room — latest clipboard overwrites previous.

### Android Local Storage (SharedPreferences)
- `roomId`: string
- `encryptionKey`: base64 string (plaintext for MVP, Android Keystore for production)

### Web Local Storage (localStorage)
- `clipsync_room`: string
- `clipync_key`: base64 string

---

## Encryption Design

### Shared Protocol (Android + Web)
1. Generate 12-byte random IV per message.
2. Encrypt plaintext with AES-256-GCM using shared key + IV.
3. Concatenate: `[IV (12 bytes)] + [ciphertext]`.
4. Base64-encode the combined bytes → `payload` field in Firebase.

### Decrypt
1. Base64-decode `payload`.
2. Split first 12 bytes as IV, remainder as ciphertext.
3. Decrypt with AES-256-GCM using shared key + IV.
4. Decode UTF-8 → plaintext.

### Android (Kotlin)
```kotlin
fun encrypt(plainText: String, key: SecretKey): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key)
    val iv = cipher.iv
    val ciphertext = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(iv + ciphertext, Base64.NO_WRAP)
}

fun decrypt(payload: String, key: SecretKey): String {
    val combined = Base64.decode(payload, Base64.NO_WRAP)
    val iv = combined.sliceArray(0..11)
    val ciphertext = combined.sliceArray(12 until combined.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
    return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
}
```

### Web (JavaScript)
```js
async function encrypt(plainText, base64Key) {
    const key = await crypto.subtle.importKey(
        "raw", base64ToBuffer(base64Key), "AES-GCM", false, ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, new TextEncoder().encode(plainText)
    );
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), 12);
    return bufferToBase64(combined);
}

async function decrypt(payload, base64Key) {
    const key = await crypto.subtle.importKey(
        "raw", base64ToBuffer(base64Key), "AES-GCM", false, ["decrypt"]
    );
    const combined = base64ToBuffer(payload);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, ciphertext
    );
    return new TextDecoder().decode(plaintext);
}
```

---

## Data Flow

### Android → Laptop
1. User copies text on Android.
2. `ClipboardManager.OnPrimaryClipChangedListener` fires in keyboard IME.
3. Coroutine: encrypt text → push to Firebase `/rooms/{roomId}/clipboard`.
4. Web app Firebase listener receives update → decrypt → display with timestamp.
5. User clicks "Copy to Laptop Clipboard" → `navigator.clipboard.writeText()`.

### Laptop → Android
1. User types in web app textarea → clicks "Send to Phone".
2. Web app encrypts text → push to Firebase with `from: "web"`.
3. Android Firebase listener receives update → decrypt → stores pending paste text.
4. "Paste from Laptop" key on keyboard activates → `InputConnection.commitText()` inserts text.

---

## Pairing Flow

1. Android app generates `roomId` (8-char alphanumeric) + 256-bit key on first launch.
2. Displays QR code: `{ "room": "abc12345", "key": "<base64-256bit-key>" }`.
3. User opens web app → clicks "Pair Device" → camera opens via `html5-qrcode`.
4. Web app scans QR → parses JSON → stores in `localStorage` → connects to Firebase room.
5. Subsequent visits: check `localStorage` → skip pairing if already stored.

---

## Firebase Security Rules (MVP)

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

Payloads are encrypted; public access is acceptable for MVP. Production hardening: derive an auth token from the room key.

---

## Android IME Architecture

```
ClipSyncIMEService (InputMethodService)
├── onCreateInputView()         → inflate keyboard layout
├── onStartInputView()          → start clipboard listener
├── onFinishInputView()         → stop clipboard listener
├── ClipboardListener           → OnPrimaryClipChangedListener
│   └── → CoroutineScope.launch → encrypt → FirebaseHelper.push()
├── FirebaseHelper
│   ├── push(payload)           → setValue on Firebase ref
│   └── listen(callback)        → addValueEventListener
├── CryptoHelper
│   ├── encrypt(text, key)
│   └── decrypt(payload, key)
└── KeyboardView
    ├── QWERTY layout
    └── Toolbar: [status] [Paste from Laptop] [Settings]
```

---

## Web App Architecture

```
index.html
├── Pairing Screen (shown if no localStorage entry)
│   └── html5-qrcode scanner → parse → store → show main UI
└── Main Screen
    ├── "Last from Phone" panel
    │   ├── decrypted text display
    │   ├── timestamp
    │   └── "Copy to Clipboard" button
    ├── "Send to Phone" panel
    │   ├── textarea
    │   └── "Send" button → encrypt → Firebase push
    └── Status bar (Firebase online/offline)

app.js
├── Firebase init & real-time listener
├── QR scan handler
├── UI state management (paired / unpaired)
└── import from crypto.js

crypto.js
├── encrypt(text, base64Key) → base64 payload
└── decrypt(payload, base64Key) → plaintext
```

---

## Development Phases

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 0 | Firebase setup, Android PoC (plain app), Web PoC | 1-2 weeks |
| Phase 1 | QR pairing, Vercel deployment, stable E2E encryption | 2 weeks |
| Phase 2 | Full keyboard IME, toolbar, clipboard listener, paste action | 3-4 weeks |
| Phase 3 | Polish, error handling, duplicate detection, beta testing | 2 weeks |
