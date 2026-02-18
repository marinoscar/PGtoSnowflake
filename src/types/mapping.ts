import type { EncryptedPayload } from './config.js';
import type { PgTableMetadata } from './postgres.js';

export interface MappingConnectionInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  password: EncryptedPayload;
  ssl: boolean;
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
    connection: MappingConnectionInfo;
  };
  selectedSchemas: string[];
  tables: PgTableMetadata[];
  exportOptions: MappingExportOptions;
}
