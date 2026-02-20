import type { SourceConnectionConfig, SourceTableMetadata, SourceColumn } from '../types/source-engine.js';
import type { SnowflakeColumn } from '../types/snowflake.js';
import type { ExportFormat, ExportResult } from '../types/export.js';

export interface SourceAdapter {
  readonly engineName: string;        // Display name (e.g. "PostgreSQL")
  readonly defaultPort: number;
  readonly defaultUser: string;
  readonly supportsSchemas: boolean;  // false for MySQL
  readonly systemSchemas: string[];

  connect(config: SourceConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(config: SourceConnectionConfig): Promise<boolean>;

  getSchemas(config?: SourceConnectionConfig): Promise<{ schemaName: string }[]>;
  getTables(schemaName: string): Promise<{ schemaName: string; tableName: string }[]>;
  introspectTable(schemaName: string, tableName: string): Promise<SourceTableMetadata>;
  introspectSchema(schemaName: string, tableNames: string[]): Promise<SourceTableMetadata[]>;

  mapColumnToSnowflake(column: SourceColumn): SnowflakeColumn;

  exportTables(
    config: SourceConnectionConfig,
    tables: { schemaName: string; tableName: string }[],
    format: ExportFormat,
    outputDir: string,
    onProgress?: (tableName: string, index: number, total: number) => void,
  ): Promise<ExportResult[]>;
}
