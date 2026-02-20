import type { SourceColumn } from '../types/source-engine.js';
import type { SnowflakeColumn } from '../types/snowflake.js';

interface TypeMappingResult {
  snowflakeType: string;
  comment: string | null;
}

const SIMPLE_TYPE_MAP: Record<string, string> = {
  // Integer types
  smallint: 'SMALLINT',
  mediumint: 'INTEGER',
  int: 'INTEGER',
  integer: 'INTEGER',
  bigint: 'BIGINT',

  // Floating point
  float: 'FLOAT',
  double: 'DOUBLE',
  real: 'DOUBLE',

  // Boolean
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',

  // Text types
  tinytext: 'VARCHAR',
  text: 'VARCHAR',
  mediumtext: 'VARCHAR',
  longtext: 'VARCHAR',

  // Date/Time
  date: 'DATE',
  time: 'TIME',
  year: 'INTEGER',
  datetime: 'TIMESTAMP_NTZ',
  timestamp: 'TIMESTAMP_TZ',

  // JSON
  json: 'VARIANT',

  // Binary types
  tinyblob: 'BINARY',
  blob: 'BINARY',
  mediumblob: 'BINARY',
  longblob: 'BINARY',
  binary: 'BINARY',
  varbinary: 'BINARY',

  // Geometry types
  geometry: 'VARCHAR',
  point: 'VARCHAR',
  linestring: 'VARCHAR',
  polygon: 'VARCHAR',
  multipoint: 'VARCHAR',
  multilinestring: 'VARCHAR',
  multipolygon: 'VARCHAR',
  geometrycollection: 'VARCHAR',

  // Bit
  bit: 'BOOLEAN',
};

function isTinyint1(column: SourceColumn): boolean {
  // MySQL tinyint(1) is used as boolean; udtName stores the full column type
  const colType = column.udtName.toLowerCase();
  return colType === 'tinyint(1)' || (column.dataType === 'tinyint' && column.numericPrecision === 3 && column.numericScale === 0 && column.characterMaximumLength === null);
}

function mapType(column: SourceColumn): TypeMappingResult {
  const dataType = column.dataType.toLowerCase();
  const colType = column.udtName.toLowerCase(); // Full column type, e.g. "tinyint(1)", "enum('a','b')"

  // tinyint(1) → BOOLEAN, other tinyint → SMALLINT
  if (dataType === 'tinyint') {
    if (isTinyint1(column)) {
      return { snowflakeType: 'BOOLEAN', comment: null };
    }
    return { snowflakeType: 'SMALLINT', comment: null };
  }

  // ENUM → VARCHAR with comment
  if (dataType === 'enum') {
    return {
      snowflakeType: 'VARCHAR',
      comment: `MySQL ENUM type: ${colType}`,
    };
  }

  // SET → VARCHAR with comment
  if (dataType === 'set') {
    return {
      snowflakeType: 'VARCHAR',
      comment: `MySQL SET type: ${colType}`,
    };
  }

  // DECIMAL/NUMERIC with precision
  if (dataType === 'decimal' || dataType === 'numeric') {
    if (column.numericPrecision !== null && column.numericScale !== null) {
      return { snowflakeType: `NUMBER(${column.numericPrecision},${column.numericScale})`, comment: null };
    }
    if (column.numericPrecision !== null) {
      return { snowflakeType: `NUMBER(${column.numericPrecision})`, comment: null };
    }
    return { snowflakeType: 'NUMBER(10,0)', comment: null };
  }

  // VARCHAR with length
  if (dataType === 'varchar') {
    if (column.characterMaximumLength) {
      return { snowflakeType: `VARCHAR(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'VARCHAR', comment: null };
  }

  // CHAR with length
  if (dataType === 'char') {
    if (column.characterMaximumLength) {
      return { snowflakeType: `CHAR(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'CHAR(1)', comment: null };
  }

  // Simple lookup
  const mapped = SIMPLE_TYPE_MAP[dataType];
  if (mapped) {
    return { snowflakeType: mapped, comment: null };
  }

  // Unknown fallback
  return {
    snowflakeType: 'VARCHAR',
    comment: `Unmapped MySQL type: ${colType} (${dataType})`,
  };
}

function mapDefault(mysqlDefault: string, dataType: string): string | null {
  // Current timestamp defaults
  if (mysqlDefault === 'CURRENT_TIMESTAMP' || mysqlDefault === 'current_timestamp()') {
    return 'CURRENT_TIMESTAMP()';
  }

  // Boolean defaults
  if (dataType === 'tinyint') {
    if (mysqlDefault === '1') return 'TRUE';
    if (mysqlDefault === '0') return 'FALSE';
  }

  // NULL default
  if (mysqlDefault === 'NULL' || mysqlDefault === 'null') return null;

  return mysqlDefault;
}

export function mapMysqlColumn(column: SourceColumn): SnowflakeColumn {
  const isAutoIncrement = column.isIdentity;
  const { snowflakeType, comment } = mapType(column);

  let defaultValue: string | null = null;
  if (column.columnDefault && !isAutoIncrement) {
    defaultValue = mapDefault(column.columnDefault, column.dataType);
  }

  return {
    name: column.columnName,
    type: isAutoIncrement ? snowflakeType : snowflakeType,
    nullable: column.isNullable,
    defaultValue,
    isIdentity: isAutoIncrement,
    identitySeed: 1,
    identityIncrement: 1,
    comment,
  };
}
