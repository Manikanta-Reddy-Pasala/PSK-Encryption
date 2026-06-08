export const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
export const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 12 + 16; // 10MB + IV + Auth Tag
export const DEFAULT_PSK = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex char standard default key

export async function importKeyFromHex(hexString) {
  // Strip spaces if any
  hexString = hexString.trim().replace(/\s/g, '');
  if (hexString.length !== 64) {
    throw new Error('PSK must be exactly 64 hex characters (32 bytes)');
  }
  const keyBytes = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  return await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptChunk(chunkBuffer, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    chunkBuffer
  );

  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

export async function decryptChunk(encryptedChunkBuffer, key) {
  const buffer = new Uint8Array(encryptedChunkBuffer);
  const iv = buffer.slice(0, 12);
  const data = buffer.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );
  return decrypted;
}
