/**
 * ClipSync – Main App Logic
 * NEW FLOW: Web app generates Room ID + AES key + QR code.
 * Android app scans the QR to pair.
 */

import { encrypt, decrypt, generateKey, bufferToBase64 } from './crypto.js';
import { initFirebase, pushClipboard, listenClipboard, listenConnectionState } from './firebase.js';

// ─── Firebase config (hardcoded — same project for all users) ─────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD6DXGNHKCfipyCdIiBFEVI4ad_Qb7ubiQ",
  authDomain:        "copynex-9d170.firebaseapp.com",
  databaseURL:       "https://copynex-9d170-default-rtdb.firebaseio.com",
  projectId:         "copynex-9d170",
  storageBucket:     "copynex-9d170.firebasestorage.app",
  messagingSenderId: "735325964151",
  appId:             "1:735325964151:web:bf79478d3a80c4edc80372"
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const STORAGE_ROOM = 'clipsync_room';
const STORAGE_KEY  = 'clipsync_key';

// ─── State ────────────────────────────────────────────────────────────────────
let roomId        = null;
let encKey        = null;
let lastFromPhone = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
let pairingScreen, mainScreen;
let qrCanvas, pairingStatus, btnUnpairFromPairing;
let lastTextEl, lastTsEl, btnCopyToLaptop;
let sendTextArea, btnSend;
let statusDot, statusLabel, btnUnpair;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  pairingScreen       = document.getElementById('pairing-screen');
  mainScreen          = document.getElementById('main-screen');
  qrCanvas            = document.getElementById('qr-canvas');
  pairingStatus       = document.getElementById('pairing-status');
  btnUnpairFromPairing = document.getElementById('btn-unpair-pairing');
  lastTextEl          = document.getElementById('last-text');
  lastTsEl            = document.getElementById('last-ts');
  btnCopyToLaptop     = document.getElementById('btn-copy-laptop');
  sendTextArea        = document.getElementById('send-textarea');
  btnSend             = document.getElementById('btn-send');
  statusDot           = document.getElementById('status-dot');
  statusLabel         = document.getElementById('status-label');
  btnUnpair           = document.getElementById('btn-unpair');

  btnCopyToLaptop.addEventListener('click', copyToLaptop);
  btnSend.addEventListener('click', sendToPhone);
  btnUnpair.addEventListener('click', unpair);
  btnUnpairFromPairing?.addEventListener('click', unpair);

  // Check existing pairing
  const savedRoom = localStorage.getItem(STORAGE_ROOM);
  const savedKey  = localStorage.getItem(STORAGE_KEY);

  if (savedRoom && savedKey) {
    roomId = savedRoom;
    encKey = savedKey;
    connectAndShow();
  } else {
    await generateAndShowQR();
  }
});

// ─── QR Generation ────────────────────────────────────────────────────────────
async function generateAndShowQR() {
  showPairingScreen();

  // Generate new room ID and AES-256 key
  roomId = generateRoomId();
  encKey = await generateKey();

  // Persist immediately so Android can connect as soon as it scans
  localStorage.setItem(STORAGE_ROOM, roomId);
  localStorage.setItem(STORAGE_KEY, encKey);

  // QR payload: everything Android needs
  const qrData = JSON.stringify({
    room:     roomId,
    key:      encKey,
    fbConfig: FIREBASE_CONFIG
  });

  // Render QR code onto canvas using qrcode.js (loaded via CDN)
  pairingStatus.textContent = 'Scan this QR code with your ClipSync Android app';
  QRCode.toCanvas(qrCanvas, qrData, {
    width:           280,
    margin:          2,
    color: { dark: '#111827', light: '#ffffff' }
  }, (err) => {
    if (err) {
      pairingStatus.textContent = 'QR generation failed: ' + err.message;
    }
  });

  // Also connect to Firebase now and wait for Android to join
  initFirebase(FIREBASE_CONFIG, roomId);
  listenConnectionState(
    () => setStatus(true),
    () => setStatus(false)
  );

  // When Android scans and pushes first entry, auto-advance to main screen
  listenClipboard((data) => {
    if (data.from === 'android') {
      // Android has connected — move to main UI
      connectAndShow();
    }
  });
}

function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => chars[b % chars.length])
    .join('');
}

// ─── Connect & show main UI ───────────────────────────────────────────────────
function connectAndShow() {
  try {
    initFirebase(FIREBASE_CONFIG, roomId);
  } catch (e) {
    // already initialized — ignore
  }

  showMainScreen();

  listenConnectionState(
    () => setStatus(true),
    () => setStatus(false)
  );

  listenClipboard(async (data) => {
    if (data.from === 'web') return;
    try {
      const text = await decrypt(data.payload, encKey);
      lastFromPhone = { text, ts: data.ts };
      displayLastFromPhone(text, data.ts);
    } catch (e) {
      console.error('Decryption failed:', e);
    }
  });
}

// ─── Unpair ───────────────────────────────────────────────────────────────────
async function unpair() {
  localStorage.removeItem(STORAGE_ROOM);
  localStorage.removeItem(STORAGE_KEY);
  roomId = null;
  encKey = null;
  lastFromPhone = null;
  await generateAndShowQR();
}

// ─── Screen switching ─────────────────────────────────────────────────────────
function showPairingScreen() {
  pairingScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
}

function showMainScreen() {
  pairingScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

// ─── Main UI actions ──────────────────────────────────────────────────────────
function displayLastFromPhone(text, ts) {
  lastTextEl.classList.remove('placeholder');
  lastTextEl.textContent = text;
  lastTsEl.textContent   = `Received at ${formatTime(ts)}`;
  btnCopyToLaptop.disabled = false;
}

async function copyToLaptop() {
  if (!lastFromPhone) return;
  try {
    await navigator.clipboard.writeText(lastFromPhone.text);
    btnCopyToLaptop.textContent = 'Copied!';
    setTimeout(() => { btnCopyToLaptop.textContent = 'Copy to Clipboard'; }, 2000);
  } catch {
    alert('Clipboard access denied. Please copy the text manually.');
  }
}

async function sendToPhone() {
  const text = sendTextArea.value.trim();
  if (!text) return;

  btnSend.disabled = true;
  btnSend.textContent = 'Sending…';

  try {
    const payload = await encrypt(text, encKey);
    await pushClipboard(payload, 'web');
    sendTextArea.value = '';
    btnSend.textContent = 'Sent!';
    setTimeout(() => { btnSend.textContent = 'Send to Phone'; btnSend.disabled = false; }, 2000);
  } catch (e) {
    console.error('Send failed:', e);
    btnSend.textContent = 'Failed — retry';
    btnSend.disabled = false;
  }
}

function setStatus(online) {
  statusDot.className    = online ? 'status-dot online' : 'status-dot offline';
  statusLabel.textContent = online ? 'Connected' : 'Offline';
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
