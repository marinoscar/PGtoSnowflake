import type { SourceAdapter } from '../source-adapter.js';
import type { SourceConnectionConfig, SourceTableMetadata, SourceColumn, SourcePrimaryKey, SourceForeignKey, SourceIndex } from '../../types/source-engine.js';
import type { SnowflakeColumn } from '../../types/snowflake.js';
import type { ExportFormat, ExportResult } from '../../types/export.js';
import { MYSQL_SYSTEM_SCHEMAS, DEFAULT_MYSQL_PORT } from '../../constants.js';
import { mapMysqlColumn } from '../mysql-type-mapper.js';
import { ConnectionError } from '../../utils/error.js';
import { logInfo, logDebug, logError } from '../../utils/log-file.js';
import {
  QUERY_TABLES,
  QUERY_COLUMNS,
  QUERY_PRIMARY_KEYS,
  QUERY_FOREIGN_KEYS,
  QUERY_INDEXES,
} from '../../utils/mysql-queries.js';

type MysqlConnection = {
  execute(sql: string, values?: unknown[]): Promise<[unknown[], unknown]>;
  end(): Promise<void>;
};

let connection: MysqlConnection | null = null;

async function createConnection(config: SourceConnectionConfig): Promise<MysqlConnection> {
  const mysql2 = await import('mysql2/promise');
  return mysql2.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  }) as unknown as MysqlConnection;
}

function getConnection(): MysqlConnection {
  if (!connection) {
    throw new ConnectionError('Not connected to MySQL. Connect first.');
  }
  return connection;
}

export class MysqlAdapter implements SourceAdapter {
  readonly engineName = 'MySQL';
  readonly defaultPort = DEFAULT_MYSQL_PORT;
  readonly defaultUser = 'root';
  readonly supportsSchemas = false;
  readonly systemSchemas = MYSQL_SYSTEM_SCHEMAS;

  async connect(config: SourceConnectionConfig): Promise<void> {
    try {
      await logInfo('mysql', `Connecting to ${config.host}:${config.port}/${config.database}`);
      connection = await createConnection(config);
      await logInfo('mysql', 'Connected successfully');
    } catch (err) {
      await logError('mysql', 'Connection failed', err instanceof Error ? err : undefined);
      throw new ConnectionError(
        `Failed to connect to MySQL at ${config.host}:${config.port}/${config.database}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (connection) {
      await connection.end();
      connection = null;
      await logDebug('mysql', 'Disconnected');
    }
  }

  async testConnection(config: SourceConnectionConfig): Promise<boolean> {
    try {
      const conn = await createConnection(config);
      await conn.execute('SELECT 1');
      await conn.end();
      return true;
    } catch {
      return false;
    }
  }

  async getSchemas(config?: SourceConnectionConfig): Promise<{ schemaName: string }[]> {
    // MySQL: database = schema
    if (config) {
      return [{ schemaName: config.database }];
    }
    const conn = getConnection();
    const [rows] = await conn.execute('SELECT DATABASE() AS schemaName');
    return rows as { schemaName: string }[];
  }

  async getTables(schemaName: string): Promise<{ schemaName: string; tableName: string }[]> {
    const conn = getConnection();
    await logDebug('mysql', `Fetching tables for schema: ${schemaName}`);
    const [rows] = await conn.execute(QUERY_TABLES, [schemaName]);
    const tables = rows as { schemaName: string; tableName: string }[];
    await logDebug('mysql', `Found ${tables.length} tables in ${schemaName}`);
    return tables;
  }

  private async getColumns(schemaName: string, tableName: string): Promise<SourceColumn[]> {
    const conn = getConnection();
    const [rows] = await conn.execute(QUERY_COLUMNS, [schemaName, tableName]);
    return (rows as Record<string, unknown>[]).map((row) => ({
      schemaName: row.schemaName as string,
      tableName: row.tableName as string,
      columnName: row.columnName as string,
      ordinalPosition: Number(row.ordinalPosition),
      columnDefault: row.columnDefault as string | null,
      isNullable: Boolean(row.isNullable),
      dataType: row.dataType as string,
      udtName: row.columnType as string,  // Full column type, e.g. "tinyint(1)", "enum('a','b')"
      characterMaximumLength: row.characterMaximumLength !== null ? Number(row.characterMaximumLength) : null,
      numericPrecision: row.numericPrecision !== null ? Number(row.numericPrecision) : null,
      numericScale: row.numericScale !== null ? Number(row.numericScale) : null,
      isIdentity: Boolean(row.isIdentity),
      identityGeneration: null,
    }));
  }

  private async getPrimaryKey(schemaName: string, tableName: string): Promise<SourcePrimaryKey | null> {
    const conn = getConnection();
    const [rows] = await conn.execute(QUERY_PRIMARY_KEYS, [schemaName, tableName]);
    const pkRows = rows as { schemaName: string; tableName: string; constraintName: string; columnName: string }[];
    if (pkRows.length === 0) return null;

    return {
      schemaName: pkRows[0].schemaName,
      tableName: pkRows[0].tableName,
      constraintName: pkRows[0].constraintName,
      columns: pkRows.map((r) => r.columnName),
    };
  }

  private async getForeignKeys(schemaName: string, tableName: string): Promise<SourceForeignKey[]> {
    const conn = getConnection();
    const [rows] = await conn.execute(QUERY_FOREIGN_KEYS, [schemaName, tableName]);
    const fkRows = rows as Record<string, string>[];

    const grouped = new Map<string, SourceForeignKey>();
    for (const row of fkRows) {
      const existing = grouped.get(row.constraintName);
      if (existing) {
        existing.columns.push(row.columnName);
        existing.referencedColumns.push(row.referencedColumn);
      } else {
        grouped.set(row.constraintName, {
          schemaName: row.schemaName,
          tableName: row.tableName,
          constraintName: row.constraintName,
          columns: [row.columnName],
          referencedSchema: row.referencedSchema,
          referencedTable: row.referencedTable,
          referencedColumns: [row.referencedColumn],
          updateRule: row.updateRule,
          deleteRule: row.deleteRule,
        });
      }
    }

    return Array.from(grouped.values());
  }

  private async getIndexes(schemaName: string, tableName: string): Promise<SourceIndex[]> {
    const conn = getConnection();
    const [rows] = await conn.execute(QUERY_INDEXES, [schemaName, tableName]);
    return (rows as Record<string, unknown>[]).map((row) => ({
      schemaName: row.schemaName as string,
      tableName: row.tableName as string,
      indexName: row.indexName as string,
      indexDef: `INDEX ${row.indexName} (${row.columns})`,
      isUnique: Boolean(row.isUnique),
    }));
  }

  async introspectTable(schemaName: string, tableName: string): Promise<SourceTableMetadata> {
    await logDebug('mysql', `Introspecting ${schemaName}.${tableName}`);

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
      sequences: [], // MySQL uses AUTO_INCREMENT, no sequences
    };
  }

  async introspectSchema(schemaName: string, tableNames: string[]): Promise<SourceTableMetadata[]> {
    await logInfo('mysql', `Introspecting schema ${schemaName}: ${tableNames.length} tables`);
    const tables = await Promise.all(tableNames.map((t) => this.introspectTable(schemaName, t)));
    await logInfo('mysql', `Introspection complete for ${schemaName}`);
    return tables;
  }

  mapColumnToSnowflake(column: SourceColumn): SnowflakeColumn {
    return mapMysqlColumn(column);
  }

  async exportTables(
    config: SourceConnectionConfig,
    tables: { schemaName: string; tableName: string }[],
    format: ExportFormat,
    outputDir: string,
    onProgress?: (tableName: string, index: number, total: number) => void,
  ): Promise<ExportResult[]> {
    // Use DuckDB with MySQL extension for export
    const { DuckDBInstance } = await import('@duckdb/node-api');
    const path = await import('node:path');
    const { ensureDir, getFileSize } = await import('../../utils/file.js');

    await ensureDir(outputDir);

    const results: ExportResult[] = [];

    for (let i = 0; i < tables.length; i++) {
      const { schemaName, tableName } = tables[i];
      if (onProgress) {
        onProgress(`${schemaName}.${tableName}`, i, tables.length);
      }

      const start = Date.now();
      const outputFile = path.default.join(outputDir, `${schemaName}.${tableName}.${format}`).replace(/\\/g, '/');

      try {
        await logInfo('export', `Exporting ${schemaName}.${tableName} to ${format} via MySQL`);

        const instance = await DuckDBInstance.create(':memory:');
        const conn = await instance.connect();

        await conn.run('INSTALL mysql;');
        await conn.run('LOAD mysql;');

        const password = encodeURIComponent(config.password);
        const user = encodeURIComponent(config.user);
        const attachCmd = `ATTACH 'host=${config.host} port=${config.port} user=${user} password=${password} database=${config.database}' AS mysql_source (TYPE MYSQL, READ_ONLY);`;
        await conn.run(attachCmd);

        const qualifiedTable = `mysql_source.\`${tableName}\``;

        let copyCmd: string;
        if (format === 'parquet') {
          copyCmd = `COPY (SELECT * FROM ${qualifiedTable}) TO '${outputFile}' (FORMAT PARQUET, COMPRESSION ZSTD);`;
        } else {
          copyCmd = `COPY (SELECT * FROM ${qualifiedTable}) TO '${outputFile}' (FORMAT CSV, HEADER);`;
        }

        await conn.run(copyCmd);

        const countResult = await conn.run(`SELECT COUNT(*) AS cnt FROM ${qualifiedTable};`);
        const rows = await countResult.getRows();
        const rowCount = Number(rows[0][0]);

        await conn.run('DETACH mysql_source;');

        const duration = Date.now() - start;
        const fileSize = await getFileSize(outputFile);

        await logInfo('export', `Exported ${schemaName}.${tableName}: ${rowCount} rows in ${duration}ms`);

        results.push({
          schemaName,
          tableName,
          status: 'success',
          rowCount,
          duration,
          filePath: outputFile,
          fileSize,
        });
      } catch (err) {
        const duration = Date.now() - start;
        const error = err instanceof Error ? err : new Error(String(err));
        await logError('export', `Failed to export ${schemaName}.${tableName}`, error);

        results.push({
          schemaName,
          tableName,
          status: 'error',
          rowCount: 0,
          duration,
          filePath: outputFile,
          fileSize: 0,
          error: error.message,
        });
      }
    }

    return results;
  }
}
