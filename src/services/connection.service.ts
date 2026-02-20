import path from 'node:path';
import { CONNECTION_FILE_EXTENSION } from '../constants.js';
import type { SavedConnection } from '../types/connection.js';
import type { SourceConnectionConfig } from '../types/source-engine.js';
import { encrypt, decrypt } from './encryption.service.js';
import { resolveConfigPaths, readEncryptionKey } from './config.service.js';
import { readJsonFile, writeJsonFile, listFiles, ensureDir } from '../utils/file.js';

export async function saveConnection(name: string, config: SourceConnectionConfig): Promise<string> {
  const paths = await resolveConfigPaths();
  await ensureDir(paths.connectionsDir);
  const key = await readEncryptionKey();

  const saved: SavedConnection = {
    name,
    engine: config.engine,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: encrypt(config.password, key),
    ssl: config.ssl,
    createdAt: new Date().toISOString(),
  };

  // Add MSSQL-specific fields
  if (config.instanceName) saved.instanceName = config.instanceName;
  if (config.trustServerCertificate !== undefined) saved.trustServerCertificate = config.trustServerCertificate;

  const filePath = path.join(paths.connectionsDir, `${name}${CONNECTION_FILE_EXTENSION}`);
  await writeJsonFile(filePath, saved);
  return filePath;
}

export async function loadConnection(name: string): Promise<SavedConnection> {
  const paths = await resolveConfigPaths();
  const filePath = path.join(paths.connectionsDir, `${name}${CONNECTION_FILE_EXTENSION}`);
  return readJsonFile<SavedConnection>(filePath);
}

export async function listConnections(): Promise<string[]> {
  const paths = await resolveConfigPaths();
  const files = await listFiles(paths.connectionsDir, CONNECTION_FILE_EXTENSION);
  return files.map((f) => f.replace(CONNECTION_FILE_EXTENSION, ''));
}

export async function deleteConnection(name: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const paths = await resolveConfigPaths();
  const filePath = path.join(paths.connectionsDir, `${name}${CONNECTION_FILE_EXTENSION}`);
  await fs.unlink(filePath);
}

export function getConnectionConfig(saved: SavedConnection, decryptedPassword: string): SourceConnectionConfig {
  const config: SourceConnectionConfig = {
    engine: saved.engine ?? 'postgresql',
    host: saved.host,
    port: saved.port,
    database: saved.database,
    user: saved.user,
    password: decryptedPassword,
    ssl: saved.ssl,
  };

  if (saved.instanceName) config.instanceName = saved.instanceName;
  if (saved.trustServerCertificate !== undefined) config.trustServerCertificate = saved.trustServerCertificate;

  return config;
}

export async function decryptConnectionPassword(saved: SavedConnection): Promise<string> {
  const key = await readEncryptionKey();
  return decrypt(saved.password, key);
}
