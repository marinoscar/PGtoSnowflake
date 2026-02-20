import path from 'node:path';
import { MAPPING_FILE_EXTENSION } from '../constants.js';
import type { MappingFile } from '../types/mapping.js';
import type { SourceConnectionConfig, SourceEngine } from '../types/source-engine.js';
import { encrypt, decrypt, isEncryptedPayload } from './encryption.service.js';
import { resolveConfigPaths, readEncryptionKey } from './config.service.js';
import { readJsonFile, writeJsonFile, listFiles } from '../utils/file.js';
import { MappingError } from '../utils/error.js';

export async function saveMappingFile(mapping: MappingFile): Promise<string> {
  const paths = await resolveConfigPaths();
  const filePath = path.join(paths.mappingsDir, `${mapping.name}${MAPPING_FILE_EXTENSION}`);
  await writeJsonFile(filePath, mapping);
  return filePath;
}

export async function loadMappingFile(name: string): Promise<MappingFile> {
  const paths = await resolveConfigPaths();
  const filePath = path.join(paths.mappingsDir, `${name}${MAPPING_FILE_EXTENSION}`);
  try {
    return await readJsonFile<MappingFile>(filePath);
  } catch (err) {
    throw new MappingError(`Failed to load mapping file: ${name}`, err instanceof Error ? err : undefined);
  }
}

export async function loadMappingFileByPath(filePath: string): Promise<MappingFile> {
  try {
    return await readJsonFile<MappingFile>(filePath);
  } catch (err) {
    throw new MappingError(`Failed to load mapping file: ${filePath}`, err instanceof Error ? err : undefined);
  }
}

export async function listMappingFiles(): Promise<string[]> {
  const paths = await resolveConfigPaths();
  const files = await listFiles(paths.mappingsDir, MAPPING_FILE_EXTENSION);
  return files.map((f) => f.replace(MAPPING_FILE_EXTENSION, ''));
}

export async function encryptPassword(password: string): Promise<ReturnType<typeof encrypt>> {
  const key = await readEncryptionKey();
  return encrypt(password, key);
}

export async function decryptPassword(mapping: MappingFile): Promise<string> {
  const key = await readEncryptionKey();
  const passwordPayload = mapping.source.connection.password;

  if (isEncryptedPayload(passwordPayload)) {
    return decrypt(passwordPayload, key);
  }

  throw new MappingError('Password field is not properly encrypted');
}

export function getMappingEngine(mapping: MappingFile): SourceEngine {
  return mapping.source.engine ?? 'postgresql';
}

export function getConnectionFromMapping(mapping: MappingFile, decryptedPassword: string): SourceConnectionConfig {
  const conn = mapping.source.connection;
  const engine = mapping.source.engine ?? 'postgresql';

  const config: SourceConnectionConfig = {
    engine,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: decryptedPassword,
    ssl: conn.ssl,
  };

  if (conn.instanceName) config.instanceName = conn.instanceName;
  if (conn.trustServerCertificate !== undefined) config.trustServerCertificate = conn.trustServerCertificate;

  return config;
}
