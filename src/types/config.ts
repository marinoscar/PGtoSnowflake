export interface EncryptedPayload {
  encrypted: true;
  algorithm: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface ConfigPaths {
  configDir: string;
  mappingsDir: string;
  logsDir: string;
  keyFile: string;
}

export type ConfigLocation = 'local' | 'global';

export type KeyGenerationMethod = 'auto' | 'passphrase';
