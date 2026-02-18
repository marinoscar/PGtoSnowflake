import { DuckDBInstance } from '@duckdb/node-api';
import path from 'node:path';
import type { PgConnectionConfig } from '../types/postgres.js';
import type { ExportFormat, ExportResult } from '../types/export.js';
import { ExportError } from '../utils/error.js';
import { ensureDir, getFileSize } from '../utils/file.js';
import { logInfo, logDebug, logError } from '../utils/log-file.js';

function buildConnectionString(config: PgConnectionConfig): string {
  const password = encodeURIComponent(config.password);
  const user = encodeURIComponent(config.user);
  return `postgresql://${user}:${password}@${config.host}:${config.port}/${config.database}`;
}

export async function exportTable(
  config: PgConnectionConfig,
  schemaName: string,
  tableName: string,
  format: ExportFormat,
  outputDir: string,
): Promise<ExportResult> {
  const start = Date.now();
  // Use forward slashes for DuckDB compatibility on Windows
  const outputFile = path.join(outputDir, `${schemaName}.${tableName}.${format}`).replace(/\\/g, '/');

  await logInfo('export', `Exporting ${schemaName}.${tableName} to ${format}`);

  let instance: DuckDBInstance | null = null;
  try {
    await ensureDir(outputDir);

    instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();

    // Install and load postgres extension
    await logDebug('export', 'Installing postgres extension');
    await connection.run('INSTALL postgres;');
    await connection.run('LOAD postgres;');

    // Attach PostgreSQL
    const connStr = buildConnectionString(config);
    await logDebug('export', `Attaching PostgreSQL source`);
    await connection.run(`ATTACH '${connStr}' AS pg_source (TYPE POSTGRES, READ_ONLY);`);

    // Build COPY command
    const qualifiedTable = `pg_source."${schemaName}"."${tableName}"`;
    let copyCmd: string;

    if (format === 'parquet') {
      copyCmd = `COPY (SELECT * FROM ${qualifiedTable}) TO '${outputFile}' (FORMAT PARQUET, COMPRESSION ZSTD);`;
    } else {
      copyCmd = `COPY (SELECT * FROM ${qualifiedTable}) TO '${outputFile}' (FORMAT CSV, HEADER);`;
    }

    await logDebug('export', `Running: ${copyCmd}`);
    await connection.run(copyCmd);

    // Get row count
    const countResult = await connection.run(`SELECT COUNT(*) AS cnt FROM ${qualifiedTable};`);
    const rows = await countResult.getRows();
    const rowCount = Number(rows[0][0]);

    // Detach for resilience
    await connection.run('DETACH pg_source;');

    const duration = Date.now() - start;
    const fileSize = await getFileSize(outputFile);

    await logInfo('export', `Exported ${schemaName}.${tableName}: ${rowCount} rows in ${duration}ms (${fileSize} bytes)`);

    return {
      schemaName,
      tableName,
      status: 'success',
      rowCount,
      duration,
      filePath: outputFile,
      fileSize,
    };
  } catch (err) {
    const duration = Date.now() - start;
    const error = err instanceof Error ? err : new Error(String(err));
    await logError('export', `Failed to export ${schemaName}.${tableName}`, error);

    return {
      schemaName,
      tableName,
      status: 'error',
      rowCount: 0,
      duration,
      filePath: outputFile,
      fileSize: 0,
      error: error.message,
    };
  }
}

export async function exportTables(
  config: PgConnectionConfig,
  tables: { schemaName: string; tableName: string }[],
  format: ExportFormat,
  outputDir: string,
  onProgress?: (tableName: string, index: number, total: number) => void,
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  for (let i = 0; i < tables.length; i++) {
    const { schemaName, tableName } = tables[i];
    if (onProgress) {
      onProgress(`${schemaName}.${tableName}`, i, tables.length);
    }

    const result = await exportTable(config, schemaName, tableName, format, outputDir);
    results.push(result);
  }

  return results;
}
