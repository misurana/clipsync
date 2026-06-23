# ClipSync – Implementation Tasks

## Task 1: Project Scaffolding & GitHub Repo
Set up the GitHub monorepo and local project structure.

### Sub-tasks
- [ ] 1.1 Create GitHub repo `clipsync` (public, with README)
- [ ] 1.2 Create directory structure: `android/`, `web/`, `.kiro/`
- [ ] 1.3 Add root `README.md` with project overview and setup instructions
- [ ] 1.4 Add `.gitignore` for Android (Kotlin/Gradle) and web (node_modules)

---

## Task 2: Firebase Project Setup
Configure Firebase Realtime Database for encrypted clipboard relay.

### Sub-tasks
- [ ] 2.1 Document Firebase project creation steps (manual — requires Firebase Console)
- [ ] 2.2 Write Firebase security rules (public read/write on `/rooms/{roomId}/clipboard`)
- [ ] 2.3 Create `firebase-config.example.js` with placeholder config for web
- [ ] 2.4 Add Firebase config instructions to README

---

## Task 3: Web App – Crypto Module
Implement AES-256-GCM encryption/decryption using the Web Crypto API.

### Sub-tasks
- [ ] 3.1 Create `web/crypto.js` with `encrypt(plainText, base64Key)` function
- [ ] 3.2 Create `web/crypto.js` with `decrypt(payload, base64Key)` function
- [ ] 3.3 Add `base64ToBuffer()` and `bufferToBase64()` helper utilities
- [ ] 3.4 Verify IV is 12 bytes, prepended to ciphertext before base64 encoding

---

## Task 4: Web App – Firebase Integration
Connect web app to Firebase Realtime Database.

### Sub-tasks
- [ ] 4.1 Create `web/firebase.js` with Firebase init using config from localStorage
- [ ] 4.2 Implement `pushClipboard(payload, roomId)` to write to `/rooms/{roomId}/clipboard`
- [ ] 4.3 Implement `listenClipboard(roomId, callback)` real-time listener
- [ ] 4.4 Handle Firebase online/offline connection state

---

## Task 5: Web App – Pairing Screen
QR code scanner and pairing flow.

### Sub-tasks
- [ ] 5.1 Create pairing screen HTML in `web/index.html` (camera button, status text)
- [ ] 5.2 Integrate `html5-qrcode` library (CDN) for camera QR scanning
- [ ] 5.3 Parse scanned JSON `{ room, key }` and store in `localStorage`
- [ ] 5.4 Auto-detect existing pairing on page load and skip to main UI
- [ ] 5.5 Add "Unpair / Reset" option to clear localStorage and return to pairing screen

---

## Task 6: Web App – Main Interface
Primary clipboard sync UI.

### Sub-tasks
- [ ] 6.1 Create main interface HTML: "Last from Phone" panel + "Send to Phone" panel
- [ ] 6.2 Display decrypted text from Firebase with timestamp
- [ ] 6.3 "Copy to Laptop Clipboard" button using `navigator.clipboard.writeText()`
- [ ] 6.4 "Send to Phone" textarea + button: encrypt → push to Firebase
- [ ] 6.5 Connection status indicator (Firebase online/offline)
- [ ] 6.6 Ignore entries where `from === "web"` (don't display own sends as received)

---

## Task 7: Web App – Styling
Visual design and responsive layout.

### Sub-tasks
- [ ] 7.1 Create `web/style.css` with clean, minimal design (light + dark mode)
- [ ] 7.2 Style pairing screen (centered card, camera preview area)
- [ ] 7.3 Style main interface (two-panel layout, status badge, buttons)
- [ ] 7.4 Ensure responsive layout for desktop and tablet
- [ ] 7.5 Use Stitch MCP to generate UI design mockups for pairing and main screens

---

## Task 8: Web App – Vercel Deployment
Deploy static web app to Vercel.

### Sub-tasks
- [ ] 8.1 Create `web/vercel.json` (static output config if needed)
- [ ] 8.2 Use Vercel MCP to create and deploy the project
- [ ] 8.3 Verify deployment URL is accessible
- [ ] 8.4 Test QR scan, Firebase connect, send/receive on live deployment

---

## Task 9: Android – Project Setup
Initialize Android project structure.

### Sub-tasks
- [ ] 9.1 Create Android project in `android/` with package `com.clipsync`
- [ ] 9.2 Configure `build.gradle.kts` with dependencies: Firebase RTDB, Gson, ZXing, Coroutines
- [ ] 9.3 Add `google-services.json` placeholder and instructions
- [ ] 9.4 Configure `AndroidManifest.xml` with IME service declaration and permissions

---

## Task 10: Android – Crypto Module
AES-256-GCM encryption matching the web app protocol.

### Sub-tasks
- [ ] 10.1 Create `CryptoHelper.kt` in `sync/` package
- [ ] 10.2 Implement `encrypt(plainText: String, key: SecretKey): String`
- [ ] 10.3 Implement `decrypt(payload: String, key: SecretKey): String`
- [ ] 10.4 Ensure IV handling matches web: 12-byte IV prepended, base64 encoded

---

## Task 11: Android – Firebase Sync Helper
Firebase Realtime Database integration.

### Sub-tasks
- [ ] 11.1 Create `FirebaseHelper.kt` in `sync/` package
- [ ] 11.2 Implement `push(roomId, payload, from)` — writes to `/rooms/{roomId}/clipboard`
- [ ] 11.3 Implement `listen(roomId, callback)` — real-time value listener
- [ ] 11.4 Handle network errors gracefully (silent fail for MVP)
- [ ] 11.5 Run push operations on a coroutine (IO dispatcher)

---

## Task 12: Android – Pairing & Key Management
Room ID generation, key management, and QR code display.

### Sub-tasks
- [ ] 12.1 Create `PairingManager.kt` in `pairing/` package
- [ ] 12.2 Generate 8-char alphanumeric Room ID on first launch
- [ ] 12.3 Generate 256-bit AES key using `KeyGenerator`
- [ ] 12.4 Store `roomId` and `key` in `SharedPreferences`
- [ ] 12.5 Generate QR code bitmap from JSON `{ room, key }` using ZXing
- [ ] 12.6 Create `SetupActivity` to display QR code and pairing instructions

---

## Task 13: Android – IME Keyboard Service
Core keyboard implementation using `InputMethodService`.

### Sub-tasks
- [ ] 13.1 Create `ClipSyncIMEService.kt` extending `InputMethodService`
- [ ] 13.2 Implement QWERTY keyboard layout in XML (`res/xml/keyboard_qwerty.xml`)
- [ ] 13.3 Handle key presses: letters, shift, backspace, space, enter
- [ ] 13.4 Add toolbar row: status indicator, "Paste from Laptop" button, settings shortcut
- [ ] 13.5 Register keyboard in `AndroidManifest.xml` as IME service with `android.view.inputmethod` intent filter
- [ ] 13.6 Add `res/xml/method.xml` (IME subtypes metadata)

---

## Task 14: Android – Clipboard Listener & Sync
Clipboard monitoring and push to Firebase.

### Sub-tasks
- [ ] 14.1 Register `ClipboardManager.OnPrimaryClipChangedListener` in `onStartInputView()`
- [ ] 14.2 Unregister listener in `onFinishInputView()`
- [ ] 14.3 On clipboard change: extract text, ignore if same as last push (duplicate detection)
- [ ] 14.4 Launch coroutine: encrypt text → `FirebaseHelper.push()` with `from: "android"`
- [ ] 14.5 Update toolbar status indicator (syncing / synced / offline)

---

## Task 15: Android – Paste from Laptop
Receive and insert remote clipboard text.

### Sub-tasks
- [ ] 15.1 Start Firebase listener in `onCreateInputView()`
- [ ] 15.2 On receiving `from: "web"` entry: decrypt and store as `pendingPasteText`
- [ ] 15.3 Activate "Paste from Laptop" toolbar button when `pendingPasteText` is available
- [ ] 15.4 On button tap: call `currentInputConnection.commitText(pendingPasteText, 1)`
- [ ] 15.5 (Secondary) Call `ClipboardManager.setPrimaryClip()` after commit if permission available

---

## Task 16: GitHub – Push All Code
Commit and push all files to GitHub repo.

### Sub-tasks
- [ ] 16.1 Use GitHub MCP to push web app files (`web/` directory)
- [ ] 16.2 Use GitHub MCP to push Android scaffold files (`android/` directory)
- [ ] 16.3 Use GitHub MCP to push spec files (`.kiro/specs/`)
- [ ] 16.4 Create initial PR or tag as `v0.1.0-scaffold`
