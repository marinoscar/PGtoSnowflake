import type { SourceAdapter } from '../source-adapter.js';
import type { SourceConnectionConfig, SourceTableMetadata, SourceColumn, SourcePrimaryKey, SourceForeignKey, SourceIndex, SourceSequence } from '../../types/source-engine.js';
import type { SnowflakeColumn } from '../../types/snowflake.js';
import type { ExportFormat, ExportResult } from '../../types/export.js';
import { MSSQL_SYSTEM_SCHEMAS, DEFAULT_MSSQL_PORT } from '../../constants.js';
import { mapMssqlColumn } from '../mssql-type-mapper.js';
import { ConnectionError } from '../../utils/error.js';
import { logInfo, logDebug, logError } from '../../utils/log-file.js';
import {
  QUERY_SCHEMAS,
  QUERY_TABLES,
  QUERY_COLUMNS,
  QUERY_PRIMARY_KEYS,
  QUERY_FOREIGN_KEYS,
  QUERY_INDEXES,
  QUERY_SEQUENCES,
} from '../../utils/mssql-queries.js';

type MssqlConnectionPool = {
  request(): MssqlRequest;
  close(): Promise<void>;
};

type MssqlRequest = {
  input(name: string, value: unknown): MssqlRequest;
  query(sql: string): Promise<{ recordset: Record<string, unknown>[] }>;
};

let pool: MssqlConnectionPool | null = null;

async function createPool(config: SourceConnectionConfig): Promise<MssqlConnectionPool> {
  const mssql = await import('mssql');
  const mssqlConfig: Record<string, unknown> = {
    server: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    options: {
      encrypt: config.ssl,
      trustServerCertificate: config.trustServerCertificate ?? true,
      instanceName: config.instanceName,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  const p = await (mssql.default?.connect ?? mssql.connect)(mssqlConfig as never);
  return p as unknown as MssqlConnectionPool;
}

function getPool(): MssqlConnectionPool {
  if (!pool) {
    throw new ConnectionError('Not connected to SQL Server. Connect first.');
  }
  return pool;
}

export class MssqlAdapter implements SourceAdapter {
  readonly engineName = 'SQL Server';
  readonly defaultPort = DEFAULT_MSSQL_PORT;
  readonly defaultUser = 'sa';
  readonly supportsSchemas = true;
  readonly systemSchemas = MSSQL_SYSTEM_SCHEMAS;

  async connect(config: SourceConnectionConfig): Promise<void> {
    try {
      await logInfo('mssql', `Connecting to ${config.host}:${config.port}/${config.database}`);
      pool = await createPool(config);
      await logInfo('mssql', 'Connected successfully');
    } catch (err) {
      await logError('mssql', 'Connection failed', err instanceof Error ? err : undefined);
      throw new ConnectionError(
        `Failed to connect to SQL Server at ${config.host}:${config.port}/${config.database}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (pool) {
      await pool.close();
      pool = null;
      await logDebug('mssql', 'Disconnected');
    }
  }

  async testConnection(config: SourceConnectionConfig): Promise<boolean> {
    try {
      const p = await createPool(config);
      await p.request().query('SELECT 1');
      await p.close();
      return true;
    } catch {
      return false;
    }
  }

  async getSchemas(): Promise<{ schemaName: string }[]> {
    const p = getPool();
    await logDebug('mssql', 'Fetching schemas');
    const result = await p.request().query(QUERY_SCHEMAS);
    await logDebug('mssql', `Found ${result.recordset.length} schemas`);
    return result.recordset as { schemaName: string }[];
  }

  async getTables(schemaName: string): Promise<{ schemaName: string; tableName: string }[]> {
    const p = getPool();
    await logDebug('mssql', `Fetching tables for schema: ${schemaName}`);
    const result = await p.request()
      .input('schemaName', schemaName)
      .query(QUERY_TABLES);
    const tables = result.recordset as { schemaName: string; tableName: string }[];
    await logDebug('mssql', `Found ${tables.length} tables in ${schemaName}`);
    return tables;
  }

  private async getColumns(schemaName: string, tableName: string): Promise<SourceColumn[]> {
    const p = getPool();
    const result = await p.request()
      .input('schemaName', schemaName)
      .input('tableName', tableName)
      .query(QUERY_COLUMNS);

    return result.recordset.map((row) => {
      const isIdentity = Boolean(row.isIdentity);
      let identityGeneration: string | null = null;
      if (isIdentity && row.identitySeed !== null && row.identityIncrement !== null) {
        identityGeneration = `${row.identitySeed},${row.identityIncrement}`;
      }

      return {
        schemaName: row.schemaName as string,
        tableName: row.tableName as string,
        columnName: row.columnName as string,
        ordinalPosition: Number(row.ordinalPosition),
        columnDefault: row.columnDefault as string | null,
        isNullable: Boolean(row.isNullable),
        dataType: row.dataType as string,
        udtName: row.dataType as string,  // MSSQL uses dataType as udtName
        characterMaximumLength: row.characterMaximumLength !== null ? Number(row.characterMaximumLength) : null,
        numericPrecision: row.numericPrecision !== null ? Number(row.numericPrecision) : null,
        numericScale: row.numericScale !== null ? Number(row.numericScale) : null,
        isIdentity,
        identityGeneration,
      };
    });
  }

  private async getPrimaryKey(schemaName: string, tableName: string): Promise<SourcePrimaryKey | null> {
    const p = getPool();
    const result = await p.request()
      .input('schemaName', schemaName)
      .input('tableName', tableName)
      .query(QUERY_PRIMARY_KEYS);

    const rows = result.recordset;
    if (rows.length === 0) return null;

    return {
      schemaName: rows[0].schemaName as string,
      tableName: rows[0].tableName as string,
      constraintName: rows[0].constraintName as string,
      columns: rows.map((r) => r.columnName as string),
    };
  }

  private async getForeignKeys(schemaName: string, tableName: string): Promise<SourceForeignKey[]> {
    const p = getPool();
    const result = await p.request()
      .input('schemaName', schemaName)
      .input('tableName', tableName)
      .query(QUERY_FOREIGN_KEYS);

    const grouped = new Map<string, SourceForeignKey>();
    for (const row of result.recordset) {
      const constraintName = row.constraintName as string;
      const existing = grouped.get(constraintName);
      if (existing) {
        existing.columns.push(row.columnName as string);
        existing.referencedColumns.push(row.referencedColumn as string);
      } else {
        grouped.set(constraintName, {
          schemaName: row.schemaName as string,
          tableName: row.tableName as string,
          constraintName,
          columns: [row.columnName as string],
          referencedSchema: row.referencedSchema as string,
          referencedTable: row.referencedTable as string,
          referencedColumns: [row.referencedColumn as string],
          updateRule: row.updateRule as string,
          deleteRule: row.deleteRule as string,
        });
      }
    }

    return Array.from(grouped.values());
  }

  private async getIndexes(schemaName: string, tableName: string): Promise<SourceIndex[]> {
    const p = getPool();
    const result = await p.request()
      .input('schemaName', schemaName)
      .input('tableName', tableName)
      .query(QUERY_INDEXES);

    return result.recordset.map((row) => ({
      schemaName: row.schemaName as string,
      tableName: row.tableName as string,
      indexName: row.indexName as string,
      indexDef: `INDEX ${row.indexName} (${row.columns})`,
      isUnique: Boolean(row.isUnique),
    }));
  }

  private async getSequences(schemaName: string): Promise<SourceSequence[]> {
    const p = getPool();
    const result = await p.request()
      .input('schemaName', schemaName)
      .query(QUERY_SEQUENCES);

    return result.recordset.map((row) => ({
      schemaName: row.schemaName as string,
      sequenceName: row.sequenceName as string,
      dataType: row.dataType as string,
      startValue: row.startValue as string,
      increment: row.increment as string,
      ownerTable: null,
      ownerColumn: null,
    }));
  }

  async introspectTable(schemaName: string, tableName: string): Promise<SourceTableMetadata> {
    await logDebug('mssql', `Introspecting ${schemaName}.${tableName}`);

    const [columns, primaryKey, foreignKeys, indexes] = await Promise.all([
      this.getColumns(schemaName, tableName),
      this.getPrimaryKey(schemaName, tableName),
      this.getForeignKeys(schemaName, tableName),
      this.getIndexes(schemaName, tableName),
    ]);

    return {
      schemaName,
      tableName,
      columns,
      primaryKey,
      foreignKeys,
      indexes,
      sequences: [],
    };
  }

  async introspectSchema(schemaName: string, tableNames: string[]): Promise<SourceTableMetadata[]> {
    await logInfo('mssql', `Introspecting schema ${schemaName}: ${tableNames.length} tables`);

    const [tables, sequences] = await Promise.all([
      Promise.all(tableNames.map((t) => this.introspectTable(schemaName, t))),
      this.getSequences(schemaName),
    ]);

    // Attach sequences (MSSQL sequences are schema-level, not table-owned like PG)
    // Store them on the first table for now, or distribute as needed
    if (sequences.length > 0 && tables.length > 0) {
      tables[0].sequences = sequences;
    }

    await logInfo('mssql', `Introspection complete for ${schemaName}`);
    return tables;
  }

  mapColumnToSnowflake(column: SourceColumn): SnowflakeColumn {
    return mapMssqlColumn(column);
  }

  async exportTables(
    config: SourceConnectionConfig,
    tables: { schemaName: string; tableName: string }[],
    format: ExportFormat,
    outputDir: string,
    onProgress?: (tableName: string, index: number, total: number) => void,
  ): Promise<ExportResult[]> {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const { ensureDir, getFileSize } = await import('../../utils/file.js');
    const { DuckDBInstance } = await import('@duckdb/node-api');

    await ensureDir(outputDir);

    const results: ExportResult[] = [];

    // Connect with mssql package for streaming
    const mssql = await import('mssql');
    const mssqlConfig: Record<string, unknown> = {
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      options: {
        encrypt: config.ssl,
        trustServerCertificate: config.trustServerCertificate ?? true,
        instanceName: config.instanceName,
      },
      connectionTimeout: 15000,
      requestTimeout: 0, // No timeout for large exports
    };

    let exportPool: MssqlConnectionPool;
    try {
      exportPool = await (mssql.default?.connect ?? mssql.connect)(mssqlConfig as never) as unknown as MssqlConnectionPool;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Return error for all tables if we can't connect
      for (const { schemaName, tableName } of tables) {
        const outputFile = path.default.join(outputDir, `${schemaName}.${tableName}.${format}`).replace(/\\/g, '/');
        results.push({
          schemaName, tableName, status: 'error', rowCount: 0, duration: 0,
          filePath: outputFile, fileSize: 0, error: error.message,
        });
      }
      return results;
    }

    for (let i = 0; i < tables.length; i++) {
      const { schemaName, tableName } = tables[i];
      if (onProgress) {
        onProgress(`${schemaName}.${tableName}`, i, tables.length);
      }

      const start = Date.now();
      const outputFile = path.default.join(outputDir, `${schemaName}.${tableName}.${format}`).replace(/\\/g, '/');

      try {
        await logInfo('export', `Exporting ${schemaName}.${tableName} to ${format} via MSSQL`);

        const selectQuery = `SELECT * FROM [${schemaName}].[${tableName}]`;

        if (format === 'csv') {
          // CSV: Stream directly from mssql → CSV file
          const queryResult = await exportPool.request().query(selectQuery);
          const rows = queryResult.recordset;

          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);
            const header = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
            const lines = [header];

            for (const row of rows) {
              const values = columns.map((c) => {
                const val = row[c];
                if (val === null || val === undefined) return '';
                if (val instanceof Date) return val.toISOString();
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              });
              lines.push(values.join(','));
            }

            fs.writeFileSync(outputFile, lines.join('\n') + '\n');
          } else {
            fs.writeFileSync(outputFile, '');
          }

          const duration = Date.now() - start;
          const fileSize = await getFileSize(outputFile);

          await logInfo('export', `Exported ${schemaName}.${tableName}: ${rows.length} rows in ${duration}ms`);

          results.push({
            schemaName, tableName, status: 'success',
            rowCount: rows.length, duration, filePath: outputFile, fileSize,
          });
        } else {
          // Parquet: Load data into DuckDB in-memory, then COPY TO parquet
          const queryResult = await exportPool.request().query(selectQuery);
          const rows = queryResult.recordset;

          const instance = await DuckDBInstance.create(':memory:');
          const conn = await instance.connect();

          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);

            // Create table with VARCHAR columns, then insert data
            const colDefs = columns.map((c) => `"${c}" VARCHAR`).join(', ');
            await conn.run(`CREATE TABLE export_data (${colDefs});`);

            // Insert in batches
            const batchSize = 1000;
            for (let j = 0; j < rows.length; j += batchSize) {
              const batch = rows.slice(j, j + batchSize);
              const valueRows = batch.map((row) => {
                const vals = columns.map((c) => {
                  const val = row[c];
                  if (val === null || val === undefined) return 'NULL';
                  if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
                  return `'${String(val).replace(/'/g, "''")}'`;
                });
                return `(${vals.join(',')})`;
              });
              await conn.run(`INSERT INTO export_data VALUES ${valueRows.join(',')};`);
            }

            await conn.run(`COPY export_data TO '${outputFile}' (FORMAT PARQUET, COMPRESSION ZSTD);`);
          } else {
            // Empty table: create empty parquet
            await conn.run(`CREATE TABLE export_data (dummy VARCHAR);`);
            await conn.run(`COPY export_data TO '${outputFile}' (FORMAT PARQUET, COMPRESSION ZSTD);`);
          }

          const duration = Date.now() - start;
          const fileSize = await getFileSize(outputFile);

          await logInfo('export', `Exported ${schemaName}.${tableName}: ${rows.length} rows in ${duration}ms`);

          results.push({
            schemaName, tableName, status: 'success',
            rowCount: rows.length, duration, filePath: outputFile, fileSize,
          });
        }
      } catch (err) {
        const duration = Date.now() - start;
        const error = err instanceof Error ? err : new Error(String(err));
        await logError('export', `Failed to export ${schemaName}.${tableName}`, error);

        results.push({
          schemaName, tableName, status: 'error',
          rowCount: 0, duration, filePath: outputFile, fileSize: 0, error: error.message,
        });
      }
    }

    try {
      await exportPool.close();
    } catch {
      // Ignore close errors
    }

    return results;
  }
}
