// Encrypted storage utility for sensitive data in localStorage
// Uses a simple XOR encryption - NOT for highly sensitive data like passwords
// For production apps with truly sensitive data, use a proper encryption library

import { logger } from './logger';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Generate a key from the user's browser fingerprint + a salt
// This makes it harder (but not impossible) to read the data from another browser
const getEncryptionKey = (): string => {
  const salt = 'bocado-ai-storage-v1';
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');
  
  // Simple hash
  let hash = 0;
  const str = fingerprint + salt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36).padStart(16, '0');
};

// Convert string to UTF-8 byte array
const stringToUtf8Bytes = (str: string): number[] => {
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else { // surrogate pair
      i++;
      charcode = ((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff);
      utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    }
  }
  return utf8;
};

// Convert UTF-8 byte array to string
const utf8BytesToString = (bytes: number[]): string => {
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i];
    if (byte1 < 0x80) {
      str += String.fromCharCode(byte1);
      i++;
    } else if ((byte1 & 0xe0) === 0xc0) {
      str += String.fromCharCode(((byte1 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((byte1 & 0xf0) === 0xe0) {
      str += String.fromCharCode(((byte1 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else {
      const codepoint = ((byte1 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      str += String.fromCharCode(0xd800 + ((codepoint - 0x10000) >> 10), 0xdc00 + ((codepoint - 0x10000) & 0x3ff));
      i += 4;
    }
  }
  return str;
};

// XOR encryption (sufficient for obfuscation, NOT for security-critical data)
const xorEncrypt = (text: string, key: string): string => {
  // Convert to UTF-8 bytes to handle Unicode properly
  const bytes = stringToUtf8Bytes(text);
  const keyBytes = stringToUtf8Bytes(key);
  
  // XOR each byte
  const result: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    result.push(bytes[i] ^ keyBytes[i % keyBytes.length]);
  }
  
  // Convert to binary string for btoa
  let binary = '';
  for (let i = 0; i < result.length; i++) {
    binary += String.fromCharCode(result[i]);
  }
  
  return btoa(binary); // Base64 encode
};

const xorDecrypt = (encoded: string, key: string): string | null => {
  try {
    const binary = atob(encoded); // Base64 decode
    const keyBytes = stringToUtf8Bytes(key);
    
    // XOR each byte
    const bytes: number[] = [];
    for (let i = 0; i < binary.length; i++) {
      bytes.push(binary.charCodeAt(i) ^ keyBytes[i % keyBytes.length]);
    }
    
    return utf8BytesToString(bytes);
  } catch (e) {
    return null;
  }
};

export const encryptedStorage = {
  getItem: (key: string): string | null => {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      // Check if data is encrypted (starts with 'enc:')
      if (encrypted.startsWith('enc:')) {
        const key_str = getEncryptionKey();
        const decrypted = xorDecrypt(encrypted.slice(4), key_str);
        return decrypted;
      }
      
      // Legacy: return as-is (for migration)
      return encrypted;
    } catch (e) {
      logger.error('Error reading from encrypted storage', e);
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    try {
      const key_str = getEncryptionKey();
      const encrypted = 'enc:' + xorEncrypt(value, key_str);
      localStorage.setItem(key, encrypted);
    } catch (e) {
      logger.error('Error writing to encrypted storage', e);
    }
  },
  
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      logger.error('Error removing from encrypted storage', e);
    }
  },
};

// Storage wrapper that falls back to regular localStorage if encryption fails
export const safeStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null;
    
    try {
      return encryptedStorage.getItem(key);
    } catch {
      return localStorage.getItem(key);
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isBrowser) return;
    
    try {
      encryptedStorage.setItem(key, value);
    } catch {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (!isBrowser) return;
    
    try {
      encryptedStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  },
};

export default encryptedStorage;
