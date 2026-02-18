import pg from 'pg';
import type {
  PgConnectionConfig,
  PgSchema,
  PgTable,
  PgColumn,
  PgPrimaryKey,
  PgForeignKey,
  PgIndex,
  PgSequence,
  PgTableMetadata,
} from '../types/postgres.js';
import {
  QUERY_SCHEMAS,
  QUERY_TABLES,
  QUERY_COLUMNS,
  QUERY_PRIMARY_KEYS,
  QUERY_FOREIGN_KEYS,
  QUERY_INDEXES,
  QUERY_SEQUENCES,
} from '../utils/pg-queries.js';
import { ConnectionError } from '../utils/error.js';
import { logDebug, logInfo, logError } from '../utils/log-file.js';

const { Client } = pg;

let client: pg.Client | null = null;

export async function connect(config: PgConnectionConfig): Promise<void> {
  try {
    await logInfo('postgres', `Connecting to ${config.host}:${config.port}/${config.database}`);
    client = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
    await client.connect();
    await logInfo('postgres', 'Connected successfully');
  } catch (err) {
    await logError('postgres', 'Connection failed', err instanceof Error ? err : undefined);
    throw new ConnectionError(
      `Failed to connect to PostgreSQL at ${config.host}:${config.port}/${config.database}`,
      err instanceof Error ? err : undefined,
    );
  }
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    await logDebug('postgres', 'Disconnected');
  }
}

function getClient(): pg.Client {
  if (!client) {
    throw new ConnectionError('Not connected to PostgreSQL. Connect first.');
  }
  return client;
}

export async function getSchemas(): Promise<PgSchema[]> {
  const c = getClient();
  await logDebug('postgres', 'Fetching schemas');
  const result = await c.query(QUERY_SCHEMAS);
  await logDebug('postgres', `Found ${result.rows.length} schemas`);
  return result.rows;
}

export async function getTables(schemaName: string): Promise<PgTable[]> {
  const c = getClient();
  await logDebug('postgres', `Fetching tables for schema: ${schemaName}`);
  const result = await c.query(QUERY_TABLES, [schemaName]);
  await logDebug('postgres', `Found ${result.rows.length} tables in ${schemaName}`);
  return result.rows;
}

export async function getColumns(schemaName: string, tableName: string): Promise<PgColumn[]> {
  const c = getClient();
  const result = await c.query(QUERY_COLUMNS, [schemaName, tableName]);
  return result.rows;
}

export async function getPrimaryKey(schemaName: string, tableName: string): Promise<PgPrimaryKey | null> {
  const c = getClient();
  const result = await c.query(QUERY_PRIMARY_KEYS, [schemaName, tableName]);
  if (result.rows.length === 0) return null;

  return {
    schemaName: result.rows[0].schemaName,
    tableName: result.rows[0].tableName,
    constraintName: result.rows[0].constraintName,
    columns: result.rows.map((r: { columnName: string }) => r.columnName),
  };
}

export async function getForeignKeys(schemaName: string, tableName: string): Promise<PgForeignKey[]> {
  const c = getClient();
  const result = await c.query(QUERY_FOREIGN_KEYS, [schemaName, tableName]);

  // Group by constraint name for multi-column FKs
  const grouped = new Map<string, PgForeignKey>();
  for (const row of result.rows) {
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

export async function getIndexes(schemaName: string, tableName: string): Promise<PgIndex[]> {
  const c = getClient();
  const result = await c.query(QUERY_INDEXES, [schemaName, tableName]);
  return result.rows.map((row: { schemaName: string; tableName: string; indexName: string; indexDef: string }) => ({
    ...row,
    isUnique: row.indexDef.includes('UNIQUE'),
  }));
}

export async function getSequences(schemaName: string): Promise<PgSequence[]> {
  const c = getClient();
  const result = await c.query(QUERY_SEQUENCES, [schemaName]);
  return result.rows.map((row: Record<string, string | null>) => {
    // Parse owner info from regclass if available
    const ownerInfo = row.ownerInfo as string | null;
    let ownerTable: string | null = null;
    let ownerColumn: string | null = null;

    if (ownerInfo) {
      // Owner info from pg_depend may be in format schema.table
      const parts = ownerInfo.replace(/"/g, '').split('.');
      ownerTable = parts.length > 1 ? parts[1] : parts[0];
    }

    return {
      schemaName: row.schemaName as string,
      sequenceName: row.sequenceName as string,
      dataType: row.dataType as string,
      startValue: row.startValue as string,
      increment: row.increment as string,
      ownerTable,
      ownerColumn,
    };
  });
}

export async function introspectTable(schemaName: string, tableName: string): Promise<PgTableMetadata> {
  await logDebug('postgres', `Introspecting ${schemaName}.${tableName}`);

  const [columns, primaryKey, foreignKeys, indexes] = await Promise.all([
    getColumns(schemaName, tableName),
    getPrimaryKey(schemaName, tableName),
    getForeignKeys(schemaName, tableName),
    getIndexes(schemaName, tableName),
  ]);

  return {
    schemaName,
    tableName,
    columns,
    primaryKey,
    foreignKeys,
    indexes,
    sequences: [], // Sequences are attached per-schema later
  };
}

export async function introspectSchema(schemaName: string, tableNames: string[]): Promise<PgTableMetadata[]> {
  await logInfo('postgres', `Introspecting schema ${schemaName}: ${tableNames.length} tables`);

  const [tables, sequences] = await Promise.all([
    Promise.all(tableNames.map((t) => introspectTable(schemaName, t))),
    getSequences(schemaName),
  ]);

  // Attach sequences to their owning tables
  for (const seq of sequences) {
    if (seq.ownerTable) {
      const table = tables.find((t) => t.tableName === seq.ownerTable);
      if (table) {
        table.sequences.push(seq);
      }
    }
  }

  await logInfo('postgres', `Introspection complete for ${schemaName}`);
  return tables;
}

export async function testConnection(config: PgConnectionConfig): Promise<boolean> {
  try {
    const testClient = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
    await testClient.connect();
    await testClient.end();
    return true;
  } catch {
    return false;
  }
}
