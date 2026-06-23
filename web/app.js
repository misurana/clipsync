/**
 * ClipSync – Main App Logic
 * Manages UI state, QR pairing, Firebase connection, and clipboard sync.
 */

import { encrypt, decrypt } from './crypto.js';
import { initFirebase, pushClipboard, listenClipboard, listenConnectionState } from './firebase.js';

// ─── Storage Keys ────────────────────────────────────────────────────────────
const STORAGE_ROOM = 'clipsync_room';
const STORAGE_KEY  = 'clipsync_key';
const STORAGE_FBCFG = 'clipsync_fbconfig';

// ─── State ────────────────────────────────────────────────────────────────────
let roomId       = null;
let encKey       = null;
let lastFromPhone = null; // { payload, ts, decrypted }
let html5QrScanner = null;

// ─── DOM refs (populated after DOMContentLoaded) ─────────────────────────────
let pairingScreen, mainScreen;
let btnStartScan, qrReader, pairingStatus;
let lastTextEl, lastTsEl, btnCopyToLaptop;
let sendTextArea, btnSend;
let statusDot, statusLabel;
let btnUnpair;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Cache DOM
  pairingScreen  = document.getElementById('pairing-screen');
  mainScreen     = document.getElementById('main-screen');
  btnStartScan   = document.getElementById('btn-start-scan');
  qrReader       = document.getElementById('qr-reader');
  pairingStatus  = document.getElementById('pairing-status');
  lastTextEl     = document.getElementById('last-text');
  lastTsEl       = document.getElementById('last-ts');
  btnCopyToLaptop = document.getElementById('btn-copy-laptop');
  sendTextArea   = document.getElementById('send-textarea');
  btnSend        = document.getElementById('btn-send');
  statusDot      = document.getElementById('status-dot');
  statusLabel    = document.getElementById('status-label');
  btnUnpair      = document.getElementById('btn-unpair');

  // Wire events
  btnStartScan.addEventListener('click', startQrScan);
  btnCopyToLaptop.addEventListener('click', copyToLaptop);
  btnSend.addEventListener('click', sendToPhone);
  btnUnpair.addEventListener('click', unpair);

  // Check if already paired
  const savedRoom  = localStorage.getItem(STORAGE_ROOM);
  const savedKey   = localStorage.getItem(STORAGE_KEY);
  const savedFbCfg = localStorage.getItem(STORAGE_FBCFG);

  if (savedRoom && savedKey && savedFbCfg) {
    roomId = savedRoom;
    encKey = savedKey;
    connectAndShow(JSON.parse(savedFbCfg));
  } else {
    showPairingScreen();
  }
});

// ─── Pairing ──────────────────────────────────────────────────────────────────
function showPairingScreen() {
  pairingScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
}

function showMainScreen() {
  pairingScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

function startQrScan() {
  btnStartScan.disabled = true;
  pairingStatus.textContent = 'Starting camera…';

  // html5-qrcode loaded via CDN script tag in index.html
  html5QrScanner = new Html5Qrcode('qr-reader');

  Html5Qrcode.getCameras().then(cameras => {
    if (!cameras || cameras.length === 0) {
      pairingStatus.textContent = 'No camera found.';
      btnStartScan.disabled = false;
      return;
    }

    const cameraId = cameras[0].id;
    html5QrScanner.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onQrSuccess,
      onQrError
    );
    pairingStatus.textContent = 'Point camera at the QR code on your Android…';
  }).catch(err => {
    pairingStatus.textContent = `Camera error: ${err}`;
    btnStartScan.disabled = false;
  });
}

function onQrSuccess(decodedText) {
  html5QrScanner.stop().catch(() => {});

  let parsed;
  try {
    parsed = JSON.parse(decodedText);
  } catch {
    pairingStatus.textContent = 'Invalid QR code. Please scan the ClipSync QR from your Android app.';
    btnStartScan.disabled = false;
    return;
  }

  if (!parsed.room || !parsed.key || !parsed.fbConfig) {
    pairingStatus.textContent = 'QR code missing required fields (room, key, fbConfig).';
    btnStartScan.disabled = false;
    return;
  }

  // Persist pairing
  roomId = parsed.room;
  encKey = parsed.key;
  localStorage.setItem(STORAGE_ROOM, roomId);
  localStorage.setItem(STORAGE_KEY, encKey);
  localStorage.setItem(STORAGE_FBCFG, JSON.stringify(parsed.fbConfig));

  pairingStatus.textContent = 'Paired! Connecting…';
  connectAndShow(parsed.fbConfig);
}

function onQrError(_err) {
  // Suppress per-frame errors — scanner runs continuously
}

function connectAndShow(fbConfig) {
  try {
    initFirebase(fbConfig, roomId);
  } catch (e) {
    console.error('Firebase init failed:', e);
    showPairingScreen();
    pairingStatus.textContent = 'Firebase connection failed. Please re-pair.';
    return;
  }

  showMainScreen();

  // Connection state
  listenConnectionState(
    () => setStatus(true),
    () => setStatus(false)
  );

  // Listen for incoming clipboard (from Android)
  listenClipboard(async (data) => {
    if (data.from === 'web') return; // ignore own sends

    try {
      const text = await decrypt(data.payload, encKey);
      lastFromPhone = { text, ts: data.ts };
      displayLastFromPhone(text, data.ts);
    } catch (e) {
      console.error('Decryption failed:', e);
    }
  });
}

function unpair() {
  localStorage.removeItem(STORAGE_ROOM);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_FBCFG);
  roomId = null;
  encKey = null;
  lastFromPhone = null;
  showPairingScreen();
  pairingStatus.textContent = '';
  btnStartScan.disabled = false;
}

// ─── Main UI ──────────────────────────────────────────────────────────────────
function displayLastFromPhone(text, ts) {
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
  } catch (e) {
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
  statusDot.className   = online ? 'status-dot online' : 'status-dot offline';
  statusLabel.textContent = online ? 'Connected' : 'Offline';
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
