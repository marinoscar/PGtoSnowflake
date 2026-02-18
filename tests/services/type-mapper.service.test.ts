import { describe, it, expect } from 'vitest';
import { mapColumn, mapAllColumns } from '../../src/services/type-mapper.service.js';
import type { PgColumn } from '../../src/types/postgres.js';

function makeColumn(overrides: Partial<PgColumn> = {}): PgColumn {
  return {
    schemaName: 'public',
    tableName: 'test_table',
    columnName: 'test_col',
    ordinalPosition: 1,
    columnDefault: null,
    isNullable: true,
    dataType: 'integer',
    udtName: 'int4',
    characterMaximumLength: null,
    numericPrecision: null,
    numericScale: null,
    isIdentity: false,
    identityGeneration: null,
    ...overrides,
  };
}

describe('type-mapper.service', () => {
  describe('integer types', () => {
    it('should map int2 to SMALLINT', () => {
      const result = mapColumn(makeColumn({ udtName: 'int2', dataType: 'smallint' }));
      expect(result.type).toBe('SMALLINT');
    });

    it('should map int4 to INTEGER', () => {
      const result = mapColumn(makeColumn({ udtName: 'int4', dataType: 'integer' }));
      expect(result.type).toBe('INTEGER');
    });

    it('should map int8 to BIGINT', () => {
      const result = mapColumn(makeColumn({ udtName: 'int8', dataType: 'bigint' }));
      expect(result.type).toBe('BIGINT');
    });
  });

  describe('serial/identity columns', () => {
    it('should map serial (nextval default) to INTEGER with IDENTITY', () => {
      const result = mapColumn(makeColumn({
        udtName: 'int4',
        columnDefault: "nextval('test_table_id_seq'::regclass)",
      }));
      expect(result.type).toBe('INTEGER');
      expect(result.isIdentity).toBe(true);
    });

    it('should map bigserial to BIGINT with IDENTITY', () => {
      const result = mapColumn(makeColumn({
        udtName: 'int8',
        columnDefault: "nextval('test_table_id_seq'::regclass)",
      }));
      expect(result.type).toBe('BIGINT');
      expect(result.isIdentity).toBe(true);
    });

    it('should map identity column to IDENTITY', () => {
      const result = mapColumn(makeColumn({
        udtName: 'int4',
        isIdentity: true,
        identityGeneration: 'ALWAYS',
      }));
      expect(result.isIdentity).toBe(true);
    });
  });

  describe('numeric types', () => {
    it('should map numeric(10,2) to NUMBER(10,2)', () => {
      const result = mapColumn(makeColumn({
        udtName: 'numeric',
        dataType: 'numeric',
        numericPrecision: 10,
        numericScale: 2,
      }));
      expect(result.type).toBe('NUMBER(10,2)');
    });

    it('should map numeric without precision to NUMBER(38,0)', () => {
      const result = mapColumn(makeColumn({
        udtName: 'numeric',
        dataType: 'numeric',
      }));
      expect(result.type).toBe('NUMBER(38,0)');
    });

    it('should map float4 to FLOAT', () => {
      const result = mapColumn(makeColumn({ udtName: 'float4' }));
      expect(result.type).toBe('FLOAT');
    });

    it('should map float8 to DOUBLE', () => {
      const result = mapColumn(makeColumn({ udtName: 'float8' }));
      expect(result.type).toBe('DOUBLE');
    });
  });

  describe('text types', () => {
    it('should map varchar(255) to VARCHAR(255)', () => {
      const result = mapColumn(makeColumn({
        udtName: 'varchar',
        dataType: 'character varying',
        characterMaximumLength: 255,
      }));
      expect(result.type).toBe('VARCHAR(255)');
    });

    it('should map varchar without length to VARCHAR', () => {
      const result = mapColumn(makeColumn({
        udtName: 'varchar',
        dataType: 'character varying',
      }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map text to VARCHAR', () => {
      const result = mapColumn(makeColumn({ udtName: 'text', dataType: 'text' }));
      expect(result.type).toBe('VARCHAR');
    });

    it('should map char(10) to CHAR(10)', () => {
      const result = mapColumn(makeColumn({
        udtName: 'bpchar',
        dataType: 'character',
        characterMaximumLength: 10,
      }));
      expect(result.type).toBe('CHAR(10)');
    });
  });

  describe('date/time types', () => {
    it('should map timestamp to TIMESTAMP_NTZ', () => {
      const result = mapColumn(makeColumn({ udtName: 'timestamp' }));
      expect(result.type).toBe('TIMESTAMP_NTZ');
    });

    it('should map timestamptz to TIMESTAMP_TZ', () => {
      const result = mapColumn(makeColumn({ udtName: 'timestamptz' }));
      expect(result.type).toBe('TIMESTAMP_TZ');
    });

    it('should map date to DATE', () => {
      const result = mapColumn(makeColumn({ udtName: 'date' }));
      expect(result.type).toBe('DATE');
    });

    it('should map interval to VARCHAR with comment', () => {
      const result = mapColumn(makeColumn({ udtName: 'interval' }));
      expect(result.type).toBe('VARCHAR');
      expect(result.comment).toContain('no direct Snowflake equivalent');
    });
  });

  describe('JSON types', () => {
    it('should map json to VARIANT', () => {
      const result = mapColumn(makeColumn({ udtName: 'json' }));
      expect(result.type).toBe('VARIANT');
    });

    it('should map jsonb to VARIANT', () => {
      const result = mapColumn(makeColumn({ udtName: 'jsonb' }));
      expect(result.type).toBe('VARIANT');
    });
  });

  describe('other types', () => {
    it('should map boolean to BOOLEAN', () => {
      const result = mapColumn(makeColumn({ udtName: 'bool' }));
      expect(result.type).toBe('BOOLEAN');
    });

    it('should map bytea to BINARY', () => {
      const result = mapColumn(makeColumn({ udtName: 'bytea' }));
      expect(result.type).toBe('BINARY');
    });

    it('should map uuid to VARCHAR(36)', () => {
      const result = mapColumn(makeColumn({ udtName: 'uuid' }));
      expect(result.type).toBe('VARCHAR(36)');
    });
  });

  describe('array types', () => {
    it('should map _int4 (integer array) to ARRAY', () => {
      const result = mapColumn(makeColumn({ udtName: '_int4', dataType: 'ARRAY' }));
      expect(result.type).toBe('ARRAY');
      expect(result.comment).toContain('array type');
    });

    it('should map _text (text array) to ARRAY', () => {
      const result = mapColumn(makeColumn({ udtName: '_text', dataType: 'ARRAY' }));
      expect(result.type).toBe('ARRAY');
    });
  });

  describe('user-defined types', () => {
    it('should map USER-DEFINED enum to VARCHAR with comment', () => {
      const result = mapColumn(makeColumn({ udtName: 'my_enum_type', dataType: 'USER-DEFINED' }));
      expect(result.type).toBe('VARCHAR');
      expect(result.comment).toContain('user-defined type: my_enum_type');
    });
  });

  describe('defaults', () => {
    it('should map boolean default true', () => {
      const result = mapColumn(makeColumn({
        udtName: 'bool',
        columnDefault: 'true',
      }));
      expect(result.defaultValue).toBe('TRUE');
    });

    it('should map now() to CURRENT_TIMESTAMP()', () => {
      const result = mapColumn(makeColumn({
        udtName: 'timestamptz',
        columnDefault: 'now()',
      }));
      expect(result.defaultValue).toBe('CURRENT_TIMESTAMP()');
    });

    it('should strip type casts from defaults', () => {
      const result = mapColumn(makeColumn({
        udtName: 'varchar',
        dataType: 'character varying',
        characterMaximumLength: 50,
        columnDefault: "'active'::character varying",
      }));
      expect(result.defaultValue).toBe("'active'");
    });

    it('should not set default for serial columns', () => {
      const result = mapColumn(makeColumn({
        udtName: 'int4',
        columnDefault: "nextval('test_id_seq'::regclass)",
      }));
      expect(result.defaultValue).toBeNull();
    });
  });

  describe('nullable', () => {
    it('should preserve nullable flag', () => {
      const col = makeColumn({ isNullable: true });
      expect(mapColumn(col).nullable).toBe(true);

      const col2 = makeColumn({ isNullable: false });
      expect(mapColumn(col2).nullable).toBe(false);
    });
  });

  describe('mapAllColumns', () => {
    it('should map multiple columns', () => {
      const columns = [
        makeColumn({ columnName: 'id', udtName: 'int4', isIdentity: true }),
        makeColumn({ columnName: 'name', udtName: 'varchar', dataType: 'character varying', characterMaximumLength: 100 }),
        makeColumn({ columnName: 'created_at', udtName: 'timestamptz' }),
      ];

      const result = mapAllColumns(columns);
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('INTEGER');
      expect(result[1].type).toBe('VARCHAR(100)');
      expect(result[2].type).toBe('TIMESTAMP_TZ');
    });
  });
});
