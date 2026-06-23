/**
 * ClipSync – Main App Logic
 * Web app generates Room ID + AES key + QR code.
 * Android app scans the QR to pair.
 */

import { encrypt, decrypt, generateKey } from './crypto.js';
import { initFirebase, pushClipboard, listenClipboard, listenConnectionState } from './firebase.js';

// ─── Firebase config ──────────────────────────────────────────────────────────
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
const STORAGE_ROOM   = 'clipsync_room';
const STORAGE_KEY    = 'clipsync_key';
const STORAGE_PAIRED = 'clipsync_paired'; // only set after Android confirms scan

// ─── State ────────────────────────────────────────────────────────────────────
let roomId        = null;
let encKey        = null;
let lastFromPhone = null;
let firebaseReady = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
let pairingScreen, mainScreen;
let qrContainer, pairingStatus, btnNewQr;
let lastTextEl, lastTsEl, btnCopyToLaptop;
let sendTextArea, btnSend;
let statusDot, statusLabel, btnUnpair;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  pairingScreen   = document.getElementById('pairing-screen');
  mainScreen      = document.getElementById('main-screen');
  qrContainer     = document.getElementById('qr-container');
  pairingStatus   = document.getElementById('pairing-status');
  btnNewQr        = document.getElementById('btn-new-qr');
  lastTextEl      = document.getElementById('last-text');
  lastTsEl        = document.getElementById('last-ts');
  btnCopyToLaptop = document.getElementById('btn-copy-laptop');
  sendTextArea    = document.getElementById('send-textarea');
  btnSend         = document.getElementById('btn-send');
  statusDot       = document.getElementById('status-dot');
  statusLabel     = document.getElementById('status-label');
  btnUnpair       = document.getElementById('btn-unpair');

  btnCopyToLaptop.addEventListener('click', copyToLaptop);
  btnSend.addEventListener('click', sendToPhone);
  btnUnpair.addEventListener('click', unpair);
  btnNewQr.addEventListener('click', startFreshPairing);

  // Only go to main screen if phone has previously confirmed pairing
  const paired = localStorage.getItem(STORAGE_PAIRED) === 'true';
  const savedRoom = localStorage.getItem(STORAGE_ROOM);
  const savedKey  = localStorage.getItem(STORAGE_KEY);

  if (paired && savedRoom && savedKey) {
    roomId = savedRoom;
    encKey = savedKey;
    connectAndShow();
  } else {
    // Always show QR on first visit or if not confirmed paired
    await startFreshPairing();
  }
});

// ─── QR Generation ────────────────────────────────────────────────────────────
async function startFreshPairing() {
  // Clear old pairing state
  localStorage.removeItem(STORAGE_PAIRED);

  showPairingScreen();
  pairingStatus.textContent = 'Generating QR code…';
  qrContainer.innerHTML = '';

  // Generate new room + key every time
  roomId = generateRoomId();
  encKey = await generateKey();

  localStorage.setItem(STORAGE_ROOM, roomId);
  localStorage.setItem(STORAGE_KEY, encKey);

  const qrData = JSON.stringify({
    room:     roomId,
    key:      encKey,
    fbConfig: FIREBASE_CONFIG
  });

  // Use qrcode.js — creates an <img> inside qrContainer
  try {
    new QRCode(qrContainer, {
      text:          qrData,
      width:         260,
      height:        260,
      colorDark:     '#000000',
      colorLight:    '#ffffff',
      correctLevel:  QRCode.CorrectLevel.M
    });
    pairingStatus.textContent = 'Scan this QR code with your ClipSync Android app';
  } catch (e) {
    pairingStatus.textContent = 'QR generation failed. Try refreshing.';
    console.error('QR error:', e);
    return;
  }

  // Connect to Firebase and listen — when Android scans & pushes, advance to main
  startFirebaseListenerForPairing();
}

function startFirebaseListenerForPairing() {
  if (!firebaseReady) {
    try {
      initFirebase(FIREBASE_CONFIG, roomId);
      firebaseReady = true;
    } catch (e) {
      console.error('Firebase init failed:', e);
    }
  }

  listenClipboard((data) => {
    if (data.from === 'android') {
      // Android has connected — mark as paired and show main screen
      localStorage.setItem(STORAGE_PAIRED, 'true');
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

// ─── Main screen ──────────────────────────────────────────────────────────────
function connectAndShow() {
  if (!firebaseReady) {
    try {
      initFirebase(FIREBASE_CONFIG, roomId);
      firebaseReady = true;
    } catch (e) { /* already init */ }
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

async function unpair() {
  localStorage.removeItem(STORAGE_ROOM);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_PAIRED);
  roomId = null;
  encKey = null;
  lastFromPhone = null;
  firebaseReady = false;
  await startFreshPairing();
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showPairingScreen() {
  pairingScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
}

function showMainScreen() {
  pairingScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

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
  statusDot.className     = online ? 'status-dot online' : 'status-dot offline';
  statusLabel.textContent = online ? 'Connected' : 'Offline';
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
