/**
 * ClipSync – Firebase Module
 * Handles real-time database push and listen for clipboard sync.
 * Firebase config is loaded from localStorage after QR pairing.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  onValue,
  goOnline,
  goOffline,
  connectDatabaseEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

let _db = null;
let _roomId = null;
let _unsubscribe = null;

/**
 * Initialize Firebase with the provided config.
 * Called once after QR pairing or on page load if already paired.
 * @param {Object} firebaseConfig - Firebase project config object
 * @param {string} roomId - The ClipSync room ID
 */
function initFirebase(firebaseConfig, roomId) {
  const app = initializeApp(firebaseConfig, 'clipsync');
  _db = getDatabase(app);
  _roomId = roomId;
}

/**
 * Push an encrypted clipboard payload to Firebase.
 * @param {string} encryptedPayload - base64(IV + ciphertext)
 * @param {'android'|'web'} from - source device
 * @returns {Promise<void>}
 */
async function pushClipboard(encryptedPayload, from = 'web') {
  if (!_db || !_roomId) throw new Error('Firebase not initialized');

  const clipRef = ref(_db, `rooms/${_roomId}/clipboard`);
  await set(clipRef, {
    payload: encryptedPayload,
    ts: Date.now(),
    from
  });
}

/**
 * Listen for real-time clipboard updates.
 * @param {function} callback - Called with { payload, ts, from } on each update
 * @returns {function} unsubscribe function
 */
function listenClipboard(callback) {
  if (!_db || !_roomId) throw new Error('Firebase not initialized');

  if (_unsubscribe) _unsubscribe(); // remove previous listener

  const clipRef = ref(_db, `rooms/${_roomId}/clipboard`);
  _unsubscribe = onValue(clipRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  });

  return _unsubscribe;
}

/**
 * Listen for Firebase connection state (online/offline).
 * @param {function} onOnline - Called when connected
 * @param {function} onOffline - Called when disconnected
 */
function listenConnectionState(onOnline, onOffline) {
  if (!_db) return;

  const connRef = ref(_db, '.info/connected');
  onValue(connRef, (snapshot) => {
    if (snapshot.val() === true) {
      onOnline();
    } else {
      onOffline();
    }
  });
}

export { initFirebase, pushClipboard, listenClipboard, listenConnectionState };
