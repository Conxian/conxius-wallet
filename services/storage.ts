
/**
 * Conxius Secure Storage Service
 * AES-GCM encryption for persistent state using PBKDF2 key derivation.
 * Ensures no sensitive data is ever stored in plaintext in localStorage.
 */

const SALT_CONSTANT = "Conxius_Sovereign_Enclave_V1_Salt"; 

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
}

async function getKey(keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export const encryptState = async (state: any, pin: string): Promise<string> => {
  try {
    const salt = new TextEncoder().encode(SALT_CONSTANT); // Fixed salt for deterministic key restoration
    const keyMaterial = await getKeyMaterial(pin);
    const key = await getKey(keyMaterial, salt);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(state));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );

    const ivArray = Array.from(iv);
    const ctArray = Array.from(new Uint8Array(ciphertext));
    
    // Store as: { iv: [...], data: [...] }
    return JSON.stringify({ iv: ivArray, data: ctArray });
  } catch (e) {
    console.error("Encryption Failed:", e);
    throw new Error("Enclave Encryption Failure");
  }
};

export const decryptState = async (stored: string, pin: string): Promise<any> => {
  try {
    const { iv, data } = JSON.parse(stored);
    const salt = new TextEncoder().encode(SALT_CONSTANT);
    const keyMaterial = await getKeyMaterial(pin);
    const key = await getKey(keyMaterial, salt);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    throw new Error("Invalid Credentials");
  }
};
