// ECDH Key Generation (P-384)
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-384" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// Export Public Key to Base64 (SPKI format)
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const exportedArray = new Uint8Array(exported);
  return btoa(String.fromCharCode.apply(null, Array.from(exportedArray)));
}

// Import Public Key from Base64
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "ECDH", namedCurve: "P-384" },
    true,
    []
  );
}

// Export Private Key to Base64 (PKCS8 format)
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  const exportedArray = new Uint8Array(exported);
  return btoa(String.fromCharCode.apply(null, Array.from(exportedArray)));
}

// Import Private Key from Base64
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "ECDH", namedCurve: "P-384" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// HKDF: Derive AES-256-GCM Session Key from ECDH Shared Secret
export async function deriveAESKeyWithHKDF(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  // 1. Derive raw shared secret bits from ECDH
  const sharedSecretBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    384 // P-384 curve length in bits
  );

  // 2. Import the raw secret as HKDF key material
  const hkdfKeyMaterial = await window.crypto.subtle.importKey(
    "raw",
    sharedSecretBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // 3. Derive the final AES-256-GCM key using HKDF (SHA-256)
  return await window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0), // Fixed empty salt is acceptable for this ephemeral usage
      info: new TextEncoder().encode("WhisperLink Session Key"), // Context specific info binding
    },
    hkdfKeyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // Extractable so we can persist it across page reloads in sessionStorage
    ["encrypt", "decrypt"]
  );
}

// Export derived AES key for storage
export async function exportAESKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const exportedArray = new Uint8Array(exported);
  return btoa(String.fromCharCode.apply(null, Array.from(exportedArray)));
}

// Import derived AES key from storage
export async function importAESKey(base64Key: string): Promise<CryptoKey> {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    "raw",
    bytes.buffer,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

// AES-GCM Encrypt
export async function encryptMessage(key: CryptoKey, message: string): Promise<{ iv: string; ciphertext: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(message);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoded
  );

  const ciphertextArray = new Uint8Array(ciphertextBuffer);
  
  return {
    iv: btoa(String.fromCharCode.apply(null, Array.from(iv))),
    ciphertext: btoa(String.fromCharCode.apply(null, Array.from(ciphertextArray))),
  };
}

// AES-GCM Decrypt
export async function decryptMessage(key: CryptoKey, ivBase64: string, ciphertextBase64: string): Promise<string> {
  const ivStr = atob(ivBase64);
  const iv = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

  const ctStr = atob(ciphertextBase64);
  const ct = new Uint8Array(ctStr.length);
  for (let i = 0; i < ctStr.length; i++) ct[i] = ctStr.charCodeAt(i);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ct
  );

  return new TextDecoder().decode(decryptedBuffer);
}

// AES-GCM Encrypt File Buffer
export async function encryptFile(key: CryptoKey, fileBuffer: ArrayBuffer): Promise<{ iv: string; ciphertext: ArrayBuffer }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    fileBuffer
  );

  return {
    iv: btoa(String.fromCharCode.apply(null, Array.from(iv))),
    ciphertext: ciphertextBuffer,
  };
}

// AES-GCM Decrypt File Buffer
export async function decryptFile(key: CryptoKey, ivBase64: string, ciphertextBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const ivStr = atob(ivBase64);
  const iv = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertextBuffer
  );

  return decryptedBuffer;
}
