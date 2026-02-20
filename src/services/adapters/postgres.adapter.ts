import type { SourceAdapter } from '../source-adapter.js';
import type { SourceConnectionConfig, SourceTableMetadata, SourceColumn } from '../../types/source-engine.js';
import type { PgConnectionConfig } from '../../types/postgres.js';
import type { SnowflakeColumn } from '../../types/snowflake.js';
import type { ExportFormat, ExportResult } from '../../types/export.js';
import { SYSTEM_SCHEMAS, DEFAULT_PG_PORT } from '../../constants.js';
import * as pgService from '../postgres.service.js';
import { exportTables as duckdbExportTables } from '../duckdb-export.service.js';
import { mapColumn } from '../type-mapper.service.js';

function toPgConfig(config: SourceConnectionConfig): PgConnectionConfig {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
  };
}

export class PostgresAdapter implements SourceAdapter {
  readonly engineName = 'PostgreSQL';
  readonly defaultPort = DEFAULT_PG_PORT;
  readonly defaultUser = 'postgres';
  readonly supportsSchemas = true;
  readonly systemSchemas = SYSTEM_SCHEMAS;

  async connect(config: SourceConnectionConfig): Promise<void> {
    await pgService.connect(toPgConfig(config));
  }

  async disconnect(): Promise<void> {
    await pgService.disconnect();
  }

  async testConnection(config: SourceConnectionConfig): Promise<boolean> {
    return pgService.testConnection(toPgConfig(config));
  }

  async getSchemas(): Promise<{ schemaName: string }[]> {
    return pgService.getSchemas();
  }

  async getTables(schemaName: string): Promise<{ schemaName: string; tableName: string }[]> {
    return pgService.getTables(schemaName);
  }

  async introspectTable(schemaName: string, tableName: string): Promise<SourceTableMetadata> {
    return pgService.introspectTable(schemaName, tableName);
  }

  async introspectSchema(schemaName: string, tableNames: string[]): Promise<SourceTableMetadata[]> {
    return pgService.introspectSchema(schemaName, tableNames);
  }

  mapColumnToSnowflake(column: SourceColumn): SnowflakeColumn {
    return mapColumn(column);
  }

  async exportTables(
    config: SourceConnectionConfig,
    tables: { schemaName: string; tableName: string }[],
    format: ExportFormat,
    outputDir: string,
    onProgress?: (tableName: string, index: number, total: number) => void,
  ): Promise<ExportResult[]> {
    return duckdbExportTables(toPgConfig(config), tables, format, outputDir, onProgress);
  }
}
