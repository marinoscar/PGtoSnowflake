import { describe, it, expect } from 'vitest';
import { mapMssqlColumn } from '../../src/services/mssql-type-mapper.js';
import type { SourceColumn } from '../../src/types/source-engine.js';

function makeColumn(overrides: Partial<SourceColumn> = {}): SourceColumn {
  return {
    schemaName: 'dbo',
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

describe('mssql-type-mapper', () => {
  describe('integer types', () => {
    it('should map bit to BOOLEAN', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'bit' }));
      expect(result.type).toBe('BOOLEAN');
    });

    it('should map tinyint to SMALLINT', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'tinyint' }));
      expect(result.type).toBe('SMALLINT');
    });

    it('should map smallint to SMALLINT', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'smallint' }));
      expect(result.type).toBe('SMALLINT');
    });

    it('should map int to INTEGER', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'int' }));
      expect(result.type).toBe('INTEGER');
    });

    it('should map bigint to BIGINT', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'bigint' }));
      expect(result.type).toBe('BIGINT');
    });
  });

  describe('identity columns', () => {
    it('should map identity int to INTEGER with IDENTITY', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'int',
        isIdentity: true,
        identityGeneration: '1,1',
      }));
      expect(result.type).toBe('INTEGER');
      expect(result.isIdentity).toBe(true);
      expect(result.identitySeed).toBe(1);
      expect(result.identityIncrement).toBe(1);
    });

    it('should map identity with custom seed/increment', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'bigint',
        isIdentity: true,
        identityGeneration: '100,5',
      }));
      expect(result.isIdentity).toBe(true);
      expect(result.identitySeed).toBe(100);
      expect(result.identityIncrement).toBe(5);
    });
  });

  describe('floating point types', () => {
    it('should map float to FLOAT', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'float' }));
      expect(result.type).toBe('FLOAT');
    });

    it('should map real to FLOAT', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'real' }));
      expect(result.type).toBe('FLOAT');
    });
  });

  describe('decimal types', () => {
    it('should map decimal(10,2) to NUMBER(10,2)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'decimal',
        numericPrecision: 10,
        numericScale: 2,
      }));
      expect(result.type).toBe('NUMBER(10,2)');
    });

    it('should map numeric(18,0) to NUMBER(18,0)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'numeric',
        numericPrecision: 18,
        numericScale: 0,
      }));
      expect(result.type).toBe('NUMBER(18,0)');
    });

    it('should map money to NUMBER(19,4)', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'money' }));
      expect(result.type).toBe('NUMBER(19,4)');
    });

    it('should map smallmoney to NUMBER(10,4)', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'smallmoney' }));
      expect(result.type).toBe('NUMBER(10,4)');
    });
  });

  describe('string types', () => {
    it('should map varchar(100) to VARCHAR(100)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'varchar',
        characterMaximumLength: 100,
      }));
      expect(result.type).toBe('VARCHAR(100)');
    });

    it('should map varchar(max) to VARCHAR', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'varchar',
        characterMaximumLength: -1,
      }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map nvarchar(50) to VARCHAR(50)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'nvarchar',
        characterMaximumLength: 50,
      }));
      expect(result.type).toBe('VARCHAR(50)');
    });

    it('should map nvarchar(max) to VARCHAR', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'nvarchar',
        characterMaximumLength: -1,
      }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map char(10) to CHAR(10)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'char',
        characterMaximumLength: 10,
      }));
      expect(result.type).toBe('CHAR(10)');
    });

    it('should map nchar(10) to CHAR(10)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'nchar',
        characterMaximumLength: 10,
      }));
      expect(result.type).toBe('CHAR(10)');
    });

    it('should map text to VARCHAR', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'text' }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map ntext to VARCHAR', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'ntext' }));
      expect(result.type).toBe('VARCHAR');
    });
  });

  describe('date/time types', () => {
    it('should map date to DATE', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'date' }));
      expect(result.type).toBe('DATE');
    });

    it('should map time to TIME', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'time' }));
      expect(result.type).toBe('TIME');
    });

    it('should map datetime to TIMESTAMP_NTZ', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'datetime' }));
      expect(result.type).toBe('TIMESTAMP_NTZ');
    });

    it('should map datetime2 to TIMESTAMP_NTZ', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'datetime2' }));
      expect(result.type).toBe('TIMESTAMP_NTZ');
    });

    it('should map smalldatetime to TIMESTAMP_NTZ', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'smalldatetime' }));
      expect(result.type).toBe('TIMESTAMP_NTZ');
    });

    it('should map datetimeoffset to TIMESTAMP_TZ', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'datetimeoffset' }));
      expect(result.type).toBe('TIMESTAMP_TZ');
    });
  });

  describe('binary types', () => {
    it('should map binary(16) to BINARY(16)', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'binary',
        characterMaximumLength: 16,
      }));
      expect(result.type).toBe('BINARY(16)');
    });

    it('should map varbinary(max) to BINARY', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'varbinary',
        characterMaximumLength: -1,
      }));
      expect(result.type).toBe('BINARY');
    });

    it('should map image to BINARY', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'image' }));
      expect(result.type).toBe('BINARY');
    });
  });

  describe('special types', () => {
    it('should map uniqueidentifier to VARCHAR(36)', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'uniqueidentifier' }));
      expect(result.type).toBe('VARCHAR(36)');
    });

    it('should map xml to VARCHAR', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'xml' }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map sql_variant to VARIANT', () => {
      const result = mapMssqlColumn(makeColumn({ dataType: 'sql_variant' }));
      expect(result.type).toBe('VARIANT');
    });
  });

  describe('defaults', () => {
    it('should map getdate() default to CURRENT_TIMESTAMP()', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'datetime',
        columnDefault: '(getdate())',
      }));
      expect(result.defaultValue).toBe('CURRENT_TIMESTAMP()');
    });

    it('should map numeric default with double parens', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'int',
        columnDefault: '((0))',
      }));
      expect(result.defaultValue).toBe('0');
    });

    it('should map string default', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'varchar',
        characterMaximumLength: 50,
        columnDefault: "('active')",
      }));
      expect(result.defaultValue).toBe("'active'");
    });

    it('should not set default for identity columns', () => {
      const result = mapMssqlColumn(makeColumn({
        dataType: 'int',
        isIdentity: true,
        identityGeneration: '1,1',
        columnDefault: null,
      }));
      expect(result.defaultValue).toBeNull();
    });
  });

  describe('nullable', () => {
    it('should preserve nullable flag', () => {
      expect(mapMssqlColumn(makeColumn({ isNullable: true })).nullable).toBe(true);
      expect(mapMssqlColumn(makeColumn({ isNullable: false })).nullable).toBe(false);
    });
  });
});
