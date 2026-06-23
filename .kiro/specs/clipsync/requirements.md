# ClipSync – Requirements

## Overview
ClipSync is a cross-device clipboard sync system. It consists of an Android custom keyboard (IME) and a Vercel-hosted static web app, connected via Firebase Realtime Database. All clipboard data is end-to-end encrypted with AES-256-GCM. The server never sees plaintext.

---

## Functional Requirements

### FR1 – Pairing & Security
- FR1.1: The Android app generates a unique 8-character alphanumeric Room ID and a 256-bit AES-GCM encryption key on first launch.
- FR1.2: The Android app displays a QR code containing `{ "room": "<roomId>", "key": "<base64Key>" }`.
- FR1.3: The web app scans the QR code via the device camera and stores room ID and key in `localStorage`.
- FR1.4: All clipboard payloads are encrypted with AES-GCM using a fresh 12-byte IV per message; IV is prepended to the ciphertext before base64 encoding.
- FR1.5: Firebase security rules allow public read/write to `/rooms/{roomId}/clipboard`. Payloads are meaningless without the key.

### FR2 – Android to Laptop Sync
- FR2.1: The Android keyboard registers a `ClipboardManager.OnPrimaryClipChangedListener` when the keyboard is active.
- FR2.2: On new clipboard text, the app encrypts it and pushes to `rooms/{roomId}/clipboard`:
  ```json
  { "payload": "<base64(iv+ciphertext)>", "ts": 1719000000000, "from": "android" }
  ```
- FR2.3: The web app subscribes to real-time Firebase changes, decrypts on receipt, and displays the text.
- FR2.4: The web app provides a "Copy to Laptop Clipboard" button using `navigator.clipboard.writeText()`.

### FR3 – Laptop to Android Sync
- FR3.1: The web app has a textarea and a "Send to Phone" button.
- FR3.2: On click, the web app encrypts the text and pushes it to Firebase with `from: "web"`.
- FR3.3: The Android keyboard listens for Firebase changes and decrypts incoming entries.
- FR3.4: The keyboard shows a "Paste from Laptop" key that commits text via `InputConnection.commitText()`.
- FR3.5 (secondary): Update Android system clipboard via `ClipboardManager.setPrimaryClip()` if permitted.

### FR4 – Android Keyboard UX
- FR4.1: Full QWERTY layout with shift, backspace, space, enter, and basic autocorrect.
- FR4.2: Toolbar row containing: ClipSync status indicator, "Paste from Laptop" button (greyed when unavailable), Settings shortcut.
- FR4.3: Keyboard requests Full Access permission on installation.

### FR5 – Web App
- FR5.1: Single static page deployed on Vercel.
- FR5.2: Pairing screen (camera QR scanner) on first visit; main interface if already paired (localStorage).
- FR5.3: Main interface includes:
  - "Last synced from Phone" section with timestamp and Copy button.
  - "Send text to Phone" textarea with Send button.
  - Connection status indicator.
- FR5.4: Compatible with Chrome 90+, Firefox 90+, Edge 90+, Safari 15+.

### FR6 – Offline & Error Handling
- FR6.1: If Firebase is unreachable, the keyboard functions normally; sync is silently dropped (MVP).
- FR6.2: Duplicate detection: ignore consecutive identical clipboard entries from the same device.
- FR6.3: Timestamp-based conflict resolution: always keep the latest entry.

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Sync latency < 2 seconds under normal network |
| Security | AES-256-GCM E2E encryption; no plaintext in Firebase |
| Free-tier | Stay within Firebase: 100 simultaneous connections, 1 GB storage, 10 GB/month download |
| Keyboard perf | Encryption and Firebase push must be asynchronous (Kotlin coroutines) |
| Browser compat | Chrome 90+, Firefox 90+, Edge 90+, Safari 15+ |
| Android compat | minSdk 24 (Android 7.0) |

---

## User Stories

1. As a user, I copy a 2FA code on my phone and instantly paste it on my laptop.
2. As a user, I send a link from my laptop to my phone via the web app.
3. As a new user, I pair my devices once by scanning a QR code — no account needed.
4. As a privacy-conscious user, I want assurance that Firebase never sees my clipboard content.
5. As a user, I want the keyboard to work normally even when offline.
