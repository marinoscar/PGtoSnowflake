import type { SourceEngine } from '../types/source-engine.js';
import type { SourceAdapter } from './source-adapter.js';
import { DEFAULT_PG_PORT, DEFAULT_MYSQL_PORT, DEFAULT_MSSQL_PORT } from '../constants.js';

export async function getAdapter(engine: SourceEngine): Promise<SourceAdapter> {
  switch (engine) {
    case 'postgresql': {
      const { PostgresAdapter } = await import('./adapters/postgres.adapter.js');
      return new PostgresAdapter();
    }
    case 'mysql': {
      const { MysqlAdapter } = await import('./adapters/mysql.adapter.js');
      return new MysqlAdapter();
    }
    case 'mssql': {
      const { MssqlAdapter } = await import('./adapters/mssql.adapter.js');
      return new MssqlAdapter();
    }
    default:
      throw new Error(`Unsupported source engine: ${engine}`);
  }
}

export function getEngineDisplayName(engine: SourceEngine): string {
  switch (engine) {
    case 'postgresql': return 'PostgreSQL';
    case 'mysql': return 'MySQL';
    case 'mssql': return 'SQL Server';
    default: return engine;
  }
}

export function getDefaultPort(engine: SourceEngine): number {
  switch (engine) {
    case 'postgresql': return DEFAULT_PG_PORT;
    case 'mysql': return DEFAULT_MYSQL_PORT;
    case 'mssql': return DEFAULT_MSSQL_PORT;
    default: return DEFAULT_PG_PORT;
  }
}

export function getDefaultUser(engine: SourceEngine): string {
  switch (engine) {
    case 'postgresql': return 'postgres';
    case 'mysql': return 'root';
    case 'mssql': return 'sa';
    default: return 'postgres';
  }
}
