import { describe, it, expect } from 'vitest';
import { getMappingEngine, getConnectionFromMapping } from '../../src/services/mapping.service.js';
import type { MappingFile } from '../../src/types/mapping.js';

function makeMapping(overrides: Partial<MappingFile> = {}): MappingFile {
  return {
    version: 1,
    name: 'test-mapping',
    createdAt: '2024-01-01T00:00:00Z',
    source: {
      connection: {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'postgres',
        password: { iv: 'test', content: 'test', tag: 'test' } as never,
        ssl: false,
      },
    },
    selectedSchemas: ['public'],
    tables: [],
    exportOptions: {
      format: 'parquet',
      outputDir: './export',
    },
    ...overrides,
  };
}

describe('mapping-compat', () => {
  describe('getMappingEngine', () => {
    it('should default to postgresql for v1 mappings without engine', () => {
      const mapping = makeMapping();
      expect(getMappingEngine(mapping)).toBe('postgresql');
    });

    it('should return postgresql when engine is set to postgresql', () => {
      const mapping = makeMapping({
        version: 2,
        source: {
          engine: 'postgresql',
          connection: makeMapping().source.connection,
        },
      });
      expect(getMappingEngine(mapping)).toBe('postgresql');
    });

    it('should return mysql when engine is set to mysql', () => {
      const mapping = makeMapping({
        version: 2,
        source: {
          engine: 'mysql',
          connection: {
            ...makeMapping().source.connection,
            port: 3306,
            user: 'root',
          },
        },
      });
      expect(getMappingEngine(mapping)).toBe('mysql');
    });

    it('should return mssql when engine is set to mssql', () => {
      const mapping = makeMapping({
        version: 2,
        source: {
          engine: 'mssql',
          connection: {
            ...makeMapping().source.connection,
            port: 1433,
            user: 'sa',
          },
        },
      });
      expect(getMappingEngine(mapping)).toBe('mssql');
    });
  });

  describe('getConnectionFromMapping', () => {
    it('should return SourceConnectionConfig with engine defaulting to postgresql for v1', () => {
      const mapping = makeMapping();
      const config = getConnectionFromMapping(mapping, 'testpass');

      expect(config.engine).toBe('postgresql');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('testdb');
      expect(config.user).toBe('postgres');
      expect(config.password).toBe('testpass');
      expect(config.ssl).toBe(false);
    });

    it('should return SourceConnectionConfig with correct engine for v2', () => {
      const mapping = makeMapping({
        version: 2,
        source: {
          engine: 'mysql',
          connection: {
            ...makeMapping().source.connection,
            port: 3306,
            user: 'root',
          },
        },
      });
      const config = getConnectionFromMapping(mapping, 'testpass');

      expect(config.engine).toBe('mysql');
      expect(config.port).toBe(3306);
      expect(config.user).toBe('root');
    });

    it('should include MSSQL fields when present', () => {
      const mapping = makeMapping({
        version: 2,
        source: {
          engine: 'mssql',
          connection: {
            ...makeMapping().source.connection,
            port: 1433,
            user: 'sa',
            instanceName: 'SQLEXPRESS',
            trustServerCertificate: true,
          },
        },
      });
      const config = getConnectionFromMapping(mapping, 'testpass');

      expect(config.engine).toBe('mssql');
      expect(config.instanceName).toBe('SQLEXPRESS');
      expect(config.trustServerCertificate).toBe(true);
    });
  });
});
