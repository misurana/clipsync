/**
 * ClipSync – Crypto Module
 * AES-256-GCM encryption/decryption using Web Crypto API.
 * Protocol: 12-byte random IV prepended to ciphertext, then base64-encoded.
 */

/** Convert a base64 string to an ArrayBuffer */
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

/** Convert an ArrayBuffer (or Uint8Array) to a base64 string */
function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Import a raw base64-encoded AES-256 key for use with Web Crypto.
 * @param {string} base64Key - 256-bit key as base64 string
 * @param {string[]} usages - e.g. ["encrypt"] or ["decrypt"]
 * @returns {Promise<CryptoKey>}
 */
async function importKey(base64Key, usages) {
  return crypto.subtle.importKey(
    'raw',
    base64ToBuffer(base64Key),
    { name: 'AES-GCM' },
    false,
    usages
  );
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string} plainText
 * @param {string} base64Key - 256-bit key as base64 string
 * @returns {Promise<string>} base64(IV [12 bytes] + ciphertext)
 */
async function encrypt(plainText, base64Key) {
  const key = await importKey(base64Key, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Concatenate IV + ciphertext
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);

  return bufferToBase64(combined);
}

/**
 * Decrypt a payload encrypted with AES-256-GCM.
 * @param {string} payload - base64(IV [12 bytes] + ciphertext)
 * @param {string} base64Key - 256-bit key as base64 string
 * @returns {Promise<string>} decrypted plaintext
 */
async function decrypt(payload, base64Key) {
  const key = await importKey(base64Key, ['decrypt']);
  const combined = new Uint8Array(base64ToBuffer(payload));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Generate a new 256-bit AES-GCM key and return it as a base64 string.
 * @returns {Promise<string>} base64-encoded 32-byte key
 */
async function generateKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(raw);
}

export { encrypt, decrypt, generateKey, base64ToBuffer, bufferToBase64 };
