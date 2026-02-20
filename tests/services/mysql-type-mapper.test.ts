import { describe, it, expect } from 'vitest';
import { mapMysqlColumn } from '../../src/services/mysql-type-mapper.js';
import type { SourceColumn } from '../../src/types/source-engine.js';

function makeColumn(overrides: Partial<SourceColumn> = {}): SourceColumn {
  return {
    schemaName: 'mydb',
    tableName: 'test_table',
    columnName: 'test_col',
    ordinalPosition: 1,
    columnDefault: null,
    isNullable: true,
    dataType: 'int',
    udtName: 'int',
    characterMaximumLength: null,
    numericPrecision: null,
    numericScale: null,
    isIdentity: false,
    identityGeneration: null,
    ...overrides,
  };
}

describe('mysql-type-mapper', () => {
  describe('integer types', () => {
    it('should map tinyint(1) to BOOLEAN', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'tinyint', udtName: 'tinyint(1)' }));
      expect(result.type).toBe('BOOLEAN');
    });

    it('should map tinyint (not 1) to SMALLINT', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'tinyint', udtName: 'tinyint(4)' }));
      expect(result.type).toBe('SMALLINT');
    });

    it('should map smallint to SMALLINT', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'smallint', udtName: 'smallint' }));
      expect(result.type).toBe('SMALLINT');
    });

    it('should map mediumint to INTEGER', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'mediumint', udtName: 'mediumint' }));
      expect(result.type).toBe('INTEGER');
    });

    it('should map int to INTEGER', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'int', udtName: 'int' }));
      expect(result.type).toBe('INTEGER');
    });

    it('should map bigint to BIGINT', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'bigint', udtName: 'bigint' }));
      expect(result.type).toBe('BIGINT');
    });
  });

  describe('auto_increment', () => {
    it('should map auto_increment int to INTEGER with IDENTITY', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'int',
        udtName: 'int',
        isIdentity: true,
      }));
      expect(result.type).toBe('INTEGER');
      expect(result.isIdentity).toBe(true);
    });

    it('should map auto_increment bigint to BIGINT with IDENTITY', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'bigint',
        udtName: 'bigint',
        isIdentity: true,
      }));
      expect(result.type).toBe('BIGINT');
      expect(result.isIdentity).toBe(true);
    });
  });

  describe('floating point types', () => {
    it('should map float to FLOAT', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'float', udtName: 'float' }));
      expect(result.type).toBe('FLOAT');
    });

    it('should map double to DOUBLE', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'double', udtName: 'double' }));
      expect(result.type).toBe('DOUBLE');
    });
  });

  describe('decimal types', () => {
    it('should map decimal(10,2) to NUMBER(10,2)', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'decimal',
        udtName: 'decimal(10,2)',
        numericPrecision: 10,
        numericScale: 2,
      }));
      expect(result.type).toBe('NUMBER(10,2)');
    });

    it('should map decimal without precision to NUMBER(10,0)', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'decimal',
        udtName: 'decimal',
      }));
      expect(result.type).toBe('NUMBER(10,0)');
    });
  });

  describe('text types', () => {
    it('should map varchar(255) to VARCHAR(255)', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'varchar',
        udtName: 'varchar(255)',
        characterMaximumLength: 255,
      }));
      expect(result.type).toBe('VARCHAR(255)');
    });

    it('should map char(10) to CHAR(10)', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'char',
        udtName: 'char(10)',
        characterMaximumLength: 10,
      }));
      expect(result.type).toBe('CHAR(10)');
    });

    it('should map text to VARCHAR', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'text', udtName: 'text' }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map mediumtext to VARCHAR', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'mediumtext', udtName: 'mediumtext' }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map longtext to VARCHAR', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'longtext', udtName: 'longtext' }));
      expect(result.type).toBe('VARCHAR');
    });
  });

  describe('date/time types', () => {
    it('should map date to DATE', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'date', udtName: 'date' }));
      expect(result.type).toBe('DATE');
    });

    it('should map time to TIME', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'time', udtName: 'time' }));
      expect(result.type).toBe('TIME');
    });

    it('should map datetime to TIMESTAMP_NTZ', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'datetime', udtName: 'datetime' }));
      expect(result.type).toBe('TIMESTAMP_NTZ');
    });

    it('should map timestamp to TIMESTAMP_TZ', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'timestamp', udtName: 'timestamp' }));
      expect(result.type).toBe('TIMESTAMP_TZ');
    });

    it('should map year to INTEGER', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'year', udtName: 'year' }));
      expect(result.type).toBe('INTEGER');
    });
  });

  describe('special types', () => {
    it('should map json to VARIANT', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'json', udtName: 'json' }));
      expect(result.type).toBe('VARIANT');
    });

    it('should map enum to VARCHAR with comment', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'enum',
        udtName: "enum('active','inactive')",
      }));
      expect(result.type).toBe('VARCHAR');
      expect(result.comment).toContain('MySQL ENUM type');
    });

    it('should map set to VARCHAR with comment', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'set',
        udtName: "set('a','b','c')",
      }));
      expect(result.type).toBe('VARCHAR');
      expect(result.comment).toContain('MySQL SET type');
    });

    it('should map blob to BINARY', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'blob', udtName: 'blob' }));
      expect(result.type).toBe('BINARY');
    });

    it('should map boolean to BOOLEAN', () => {
      const result = mapMysqlColumn(makeColumn({ dataType: 'boolean', udtName: 'boolean' }));
      expect(result.type).toBe('BOOLEAN');
    });
  });

  describe('defaults', () => {
    it('should map CURRENT_TIMESTAMP default', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'datetime',
        udtName: 'datetime',
        columnDefault: 'CURRENT_TIMESTAMP',
      }));
      expect(result.defaultValue).toBe('CURRENT_TIMESTAMP()');
    });

    it('should not set default for auto_increment columns', () => {
      const result = mapMysqlColumn(makeColumn({
        dataType: 'int',
        udtName: 'int',
        isIdentity: true,
        columnDefault: null,
      }));
      expect(result.defaultValue).toBeNull();
    });
  });

  describe('nullable', () => {
    it('should preserve nullable flag', () => {
      const col = makeColumn({ isNullable: true });
      expect(mapMysqlColumn(col).nullable).toBe(true);

      const col2 = makeColumn({ isNullable: false });
      expect(mapMysqlColumn(col2).nullable).toBe(false);
    });
  });
});
