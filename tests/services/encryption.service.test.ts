import { describe, it, expect } from 'vitest';
import {
  generateRandomKey,
  deriveKeyFromPassphrase,
  encrypt,
  decrypt,
  isEncryptedPayload,
} from '../../src/services/encryption.service.js';

describe('encryption.service', () => {
  describe('generateRandomKey', () => {
    it('should generate a 64-character hex string (256-bit)', () => {
      const key = generateRandomKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique keys each time', () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('deriveKeyFromPassphrase', () => {
    it('should derive a 64-character hex key from a passphrase', () => {
      const key = deriveKeyFromPassphrase('my-secret-passphrase');
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce the same key for the same passphrase', () => {
      const key1 = deriveKeyFromPassphrase('test-passphrase');
      const key2 = deriveKeyFromPassphrase('test-passphrase');
      expect(key1).toBe(key2);
    });

    it('should produce different keys for different passphrases', () => {
      const key1 = deriveKeyFromPassphrase('passphrase-one');
      const key2 = deriveKeyFromPassphrase('passphrase-two');
      expect(key1).not.toBe(key2);
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const key = generateRandomKey();
      const plaintext = 'my-database-password';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt special characters', () => {
      const key = generateRandomKey();
      const plaintext = 'p@$$w0rd!#%^&*()_+{}|:"<>?';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode', () => {
      const key = generateRandomKey();
      const plaintext = 'пароль密码パスワード';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const key = generateRandomKey();
      const plaintext = '';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const key = generateRandomKey();
      const plaintext = 'test-password';

      const enc1 = encrypt(plaintext, key);
      const enc2 = encrypt(plaintext, key);

      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      expect(enc1.iv).not.toBe(enc2.iv);
    });

    it('should fail decryption with a wrong key', () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();
      const plaintext = 'secret';

      const encrypted = encrypt(plaintext, key1);

      expect(() => decrypt(encrypted, key2)).toThrow('Failed to decrypt');
    });

    it('should fail decryption if ciphertext is tampered with', () => {
      const key = generateRandomKey();
      const encrypted = encrypt('test', key);

      // Tamper with ciphertext
      encrypted.ciphertext = Buffer.from('tampered').toString('base64');

      expect(() => decrypt(encrypted, key)).toThrow('Failed to decrypt');
    });
  });

  describe('encrypt output structure', () => {
    it('should produce the expected EncryptedPayload shape', () => {
      const key = generateRandomKey();
      const encrypted = encrypt('test', key);

      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.tag).toBe('string');
      expect(typeof encrypted.ciphertext).toBe('string');
    });
  });

  describe('isEncryptedPayload', () => {
    it('should return true for a valid encrypted payload', () => {
      const key = generateRandomKey();
      const payload = encrypt('test', key);
      expect(isEncryptedPayload(payload)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isEncryptedPayload(null)).toBe(false);
    });

    it('should return false for a plain string', () => {
      expect(isEncryptedPayload('just-a-password')).toBe(false);
    });

    it('should return false for an incomplete object', () => {
      expect(isEncryptedPayload({ encrypted: true, algorithm: 'aes-256-gcm' })).toBe(false);
    });

    it('should return false if encrypted is not true', () => {
      expect(isEncryptedPayload({
        encrypted: false,
        algorithm: 'aes-256-gcm',
        iv: 'abc',
        tag: 'def',
        ciphertext: 'ghi',
      })).toBe(false);
    });
  });
});
