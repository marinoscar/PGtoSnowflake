import type { EncryptedPayload } from './config.js';
import type { SourceEngine } from './source-engine.js';

export interface SavedConnection {
  name: string;
  engine?: SourceEngine;  // Optional for backward compat with old connection files
  host: string;
  port: number;
  database: string;
  user: string;
  password: EncryptedPayload;
  ssl: boolean;
  instanceName?: string;            // MSSQL
  trustServerCertificate?: boolean;  // MSSQL
  createdAt: string;
}
