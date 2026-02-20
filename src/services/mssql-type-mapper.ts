import type { SourceColumn } from '../types/source-engine.js';
import type { SnowflakeColumn } from '../types/snowflake.js';

interface TypeMappingResult {
  snowflakeType: string;
  comment: string | null;
}

const SIMPLE_TYPE_MAP: Record<string, string> = {
  // Integer types
  bit: 'BOOLEAN',
  tinyint: 'SMALLINT',
  smallint: 'SMALLINT',
  int: 'INTEGER',
  bigint: 'BIGINT',

  // Floating point
  float: 'FLOAT',
  real: 'FLOAT',

  // Money
  money: 'NUMBER(19,4)',
  smallmoney: 'NUMBER(10,4)',

  // Date/Time
  date: 'DATE',
  time: 'TIME',
  datetime: 'TIMESTAMP_NTZ',
  datetime2: 'TIMESTAMP_NTZ',
  smalldatetime: 'TIMESTAMP_NTZ',
  datetimeoffset: 'TIMESTAMP_TZ',

  // Text (no length)
  text: 'VARCHAR',
  ntext: 'VARCHAR',

  // Binary (no length)
  image: 'BINARY',

  // Special types
  uniqueidentifier: 'VARCHAR(36)',
  xml: 'VARCHAR',
  sql_variant: 'VARIANT',
  hierarchyid: 'VARCHAR',
  geography: 'VARCHAR',
  geometry: 'VARCHAR',
  timestamp: 'BINARY(8)', // MSSQL timestamp/rowversion is 8-byte binary
  rowversion: 'BINARY(8)',
};

function mapType(column: SourceColumn): TypeMappingResult {
  const dataType = column.dataType.toLowerCase();

  // DECIMAL/NUMERIC with precision
  if (dataType === 'decimal' || dataType === 'numeric') {
    if (column.numericPrecision !== null && column.numericScale !== null) {
      return { snowflakeType: `NUMBER(${column.numericPrecision},${column.numericScale})`, comment: null };
    }
    if (column.numericPrecision !== null) {
      return { snowflakeType: `NUMBER(${column.numericPrecision})`, comment: null };
    }
    return { snowflakeType: 'NUMBER(18,0)', comment: null };
  }

  // VARCHAR/NVARCHAR with length
  if (dataType === 'varchar' || dataType === 'nvarchar') {
    if (column.characterMaximumLength === -1) {
      // varchar(max) / nvarchar(max)
      return { snowflakeType: 'VARCHAR', comment: null };
    }
    if (column.characterMaximumLength) {
      return { snowflakeType: `VARCHAR(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'VARCHAR', comment: null };
  }

  // CHAR/NCHAR with length
  if (dataType === 'char' || dataType === 'nchar') {
    if (column.characterMaximumLength) {
      return { snowflakeType: `CHAR(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'CHAR(1)', comment: null };
  }

  // BINARY/VARBINARY with length
  if (dataType === 'binary' || dataType === 'varbinary') {
    if (column.characterMaximumLength === -1) {
      // varbinary(max)
      return { snowflakeType: 'BINARY', comment: null };
    }
    if (column.characterMaximumLength) {
      return { snowflakeType: `BINARY(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'BINARY', comment: null };
  }

  // Simple lookup
  const mapped = SIMPLE_TYPE_MAP[dataType];
  if (mapped) {
    return { snowflakeType: mapped, comment: null };
  }

  // Unknown fallback
  return {
    snowflakeType: 'VARCHAR',
    comment: `Unmapped MSSQL type: ${dataType}`,
  };
}

function mapDefault(mssqlDefault: string): string | null {
  // MSSQL defaults are wrapped in parens, e.g. ((0)), (getdate()), ('value')
  let cleaned = mssqlDefault;

  // Strip outer parens
  while (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1);
  }

  // Current timestamp defaults
  if (cleaned.toLowerCase() === 'getdate()' || cleaned.toLowerCase() === 'sysdatetime()') {
    return 'CURRENT_TIMESTAMP()';
  }
  if (cleaned.toLowerCase() === 'getutcdate()' || cleaned.toLowerCase() === 'sysutcdatetime()') {
    return 'CURRENT_TIMESTAMP()';
  }
  if (cleaned.toLowerCase() === 'sysdatetimeoffset()') {
    return 'CURRENT_TIMESTAMP()';
  }

  // NEWID() → UUID default
  if (cleaned.toLowerCase() === 'newid()') {
    return null; // No direct Snowflake equivalent as default
  }

  // Numeric/string literals
  if (cleaned) return cleaned;

  return null;
}

export function mapMssqlColumn(column: SourceColumn): SnowflakeColumn {
  const isIdentityCol = column.isIdentity;
  const { snowflakeType, comment } = mapType(column);

  // Parse identity seed/increment from udtName if available
  let identitySeed = 1;
  let identityIncrement = 1;
  if (isIdentityCol && column.identityGeneration) {
    // identityGeneration stores "seed,increment" for MSSQL
    const parts = column.identityGeneration.split(',');
    if (parts.length === 2) {
      identitySeed = parseInt(parts[0], 10) || 1;
      identityIncrement = parseInt(parts[1], 10) || 1;
    }
  }

  let defaultValue: string | null = null;
  if (column.columnDefault && !isIdentityCol) {
    defaultValue = mapDefault(column.columnDefault);
  }

  return {
    name: column.columnName,
    type: snowflakeType,
    nullable: column.isNullable,
    defaultValue,
    isIdentity: isIdentityCol,
    identitySeed,
    identityIncrement,
    comment,
  };
}
