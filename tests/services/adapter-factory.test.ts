import { describe, it, expect } from 'vitest';
import { getAdapter, getEngineDisplayName, getDefaultPort, getDefaultUser } from '../../src/services/adapter-factory.js';

describe('adapter-factory', () => {
  describe('getEngineDisplayName', () => {
    it('should return PostgreSQL for postgresql', () => {
      expect(getEngineDisplayName('postgresql')).toBe('PostgreSQL');
    });

    it('should return MySQL for mysql', () => {
      expect(getEngineDisplayName('mysql')).toBe('MySQL');
    });

    it('should return SQL Server for mssql', () => {
      expect(getEngineDisplayName('mssql')).toBe('SQL Server');
    });
  });

  describe('getDefaultPort', () => {
    it('should return 5432 for postgresql', () => {
      expect(getDefaultPort('postgresql')).toBe(5432);
    });

    it('should return 3306 for mysql', () => {
      expect(getDefaultPort('mysql')).toBe(3306);
    });

    it('should return 1433 for mssql', () => {
      expect(getDefaultPort('mssql')).toBe(1433);
    });
  });

  describe('getDefaultUser', () => {
    it('should return postgres for postgresql', () => {
      expect(getDefaultUser('postgresql')).toBe('postgres');
    });

    it('should return root for mysql', () => {
      expect(getDefaultUser('mysql')).toBe('root');
    });

    it('should return sa for mssql', () => {
      expect(getDefaultUser('mssql')).toBe('sa');
    });
  });

  describe('getAdapter', () => {
    it('should return PostgresAdapter for postgresql', async () => {
      const adapter = await getAdapter('postgresql');
      expect(adapter.engineName).toBe('PostgreSQL');
      expect(adapter.defaultPort).toBe(5432);
      expect(adapter.supportsSchemas).toBe(true);
    });

    it('should return MysqlAdapter for mysql', async () => {
      const adapter = await getAdapter('mysql');
      expect(adapter.engineName).toBe('MySQL');
      expect(adapter.defaultPort).toBe(3306);
      expect(adapter.supportsSchemas).toBe(false);
    });

    it('should return MssqlAdapter for mssql', async () => {
      const adapter = await getAdapter('mssql');
      expect(adapter.engineName).toBe('SQL Server');
      expect(adapter.defaultPort).toBe(1433);
      expect(adapter.supportsSchemas).toBe(true);
    });

    it('should throw for unsupported engine', async () => {
      await expect(getAdapter('oracle' as never)).rejects.toThrow('Unsupported source engine');
    });
  });
});
