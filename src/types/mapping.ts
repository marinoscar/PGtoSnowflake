import type { EncryptedPayload } from './config.js';
import type { SourceEngine, SourceTableMetadata } from './source-engine.js';

export interface MappingConnectionInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  password: EncryptedPayload;
  ssl: boolean;
  instanceName?: string;            // MSSQL
  trustServerCertificate?: boolean;  // MSSQL
}

export interface MappingExportOptions {
  format: 'parquet' | 'csv';
  outputDir: string;
}

export interface MappingFile {
  version: number;
  name: string;
  createdAt: string;
  source: {
    engine?: SourceEngine;  // Optional for v1 compat; always written for v2
    connection: MappingConnectionInfo;
  };
  selectedSchemas: string[];
  tables: SourceTableMetadata[];
  exportOptions: MappingExportOptions;
}
