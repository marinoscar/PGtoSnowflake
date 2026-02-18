import type { PgColumn } from '../types/postgres.js';
import type { SnowflakeColumn } from '../types/snowflake.js';

interface TypeMappingResult {
  snowflakeType: string;
  comment: string | null;
}

const SIMPLE_TYPE_MAP: Record<string, string> = {
  // Integer types
  int2: 'SMALLINT',
  int4: 'INTEGER',
  int8: 'BIGINT',
  smallint: 'SMALLINT',
  integer: 'INTEGER',
  bigint: 'BIGINT',

  // Floating point
  float4: 'FLOAT',
  float8: 'DOUBLE',
  real: 'FLOAT',
  'double precision': 'DOUBLE',
  money: 'NUMBER(19,4)',

  // Boolean
  bool: 'BOOLEAN',
  boolean: 'BOOLEAN',

  // Text types
  text: 'VARCHAR',
  name: 'VARCHAR',
  char: 'CHAR',
  bpchar: 'CHAR',

  // Date/Time
  date: 'DATE',
  time: 'TIME',
  timetz: 'TIME',
  timestamp: 'TIMESTAMP_NTZ',
  timestamptz: 'TIMESTAMP_TZ',

  // JSON
  json: 'VARIANT',
  jsonb: 'VARIANT',

  // Binary
  bytea: 'BINARY',

  // UUID
  uuid: 'VARCHAR(36)',

  // Network types
  inet: 'VARCHAR(45)',
  cidr: 'VARCHAR(49)',
  macaddr: 'VARCHAR(17)',
  macaddr8: 'VARCHAR(23)',

  // Geometric types
  point: 'VARCHAR',
  line: 'VARCHAR',
  lseg: 'VARCHAR',
  box: 'VARCHAR',
  path: 'VARCHAR',
  polygon: 'VARCHAR',
  circle: 'VARCHAR',

  // Other
  xml: 'VARCHAR',
  interval: 'VARCHAR',
  tsvector: 'VARCHAR',
  tsquery: 'VARCHAR',
  oid: 'INTEGER',
  regclass: 'VARCHAR',
  regtype: 'VARCHAR',
};

function mapType(column: PgColumn): TypeMappingResult {
  const udtName = column.udtName;
  const dataType = column.dataType;

  // Array types (PG stores them with underscore prefix in udt_name)
  if (udtName.startsWith('_')) {
    const baseType = udtName.substring(1);
    const mappedBase = SIMPLE_TYPE_MAP[baseType];
    return {
      snowflakeType: 'ARRAY',
      comment: `PostgreSQL array type: ${baseType}[]${mappedBase ? '' : ` (base type ${baseType} not directly mapped)`}`,
    };
  }

  // Numeric/decimal with precision
  if (udtName === 'numeric' || dataType === 'numeric') {
    if (column.numericPrecision !== null && column.numericScale !== null) {
      return { snowflakeType: `NUMBER(${column.numericPrecision},${column.numericScale})`, comment: null };
    }
    if (column.numericPrecision !== null) {
      return { snowflakeType: `NUMBER(${column.numericPrecision})`, comment: null };
    }
    return { snowflakeType: 'NUMBER(38,0)', comment: null };
  }

  // VARCHAR with length
  if (udtName === 'varchar' || dataType === 'character varying') {
    if (column.characterMaximumLength) {
      return { snowflakeType: `VARCHAR(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'VARCHAR', comment: null };
  }

  // CHAR with length
  if (udtName === 'bpchar' || udtName === 'char' || dataType === 'character') {
    if (column.characterMaximumLength) {
      return { snowflakeType: `CHAR(${column.characterMaximumLength})`, comment: null };
    }
    return { snowflakeType: 'CHAR(1)', comment: null };
  }

  // Simple lookup
  const mapped = SIMPLE_TYPE_MAP[udtName] || SIMPLE_TYPE_MAP[dataType];
  if (mapped) {
    let comment: string | null = null;
    if (udtName === 'interval') {
      comment = 'PostgreSQL INTERVAL has no direct Snowflake equivalent';
    }
    return { snowflakeType: mapped, comment };
  }

  // User-defined or enum types → VARCHAR with comment
  if (dataType === 'USER-DEFINED') {
    return {
      snowflakeType: 'VARCHAR',
      comment: `PostgreSQL user-defined type: ${udtName}`,
    };
  }

  // Unknown fallback
  return {
    snowflakeType: 'VARCHAR',
    comment: `Unmapped PostgreSQL type: ${udtName} (${dataType})`,
  };
}

function isSerialColumn(column: PgColumn): boolean {
  if (column.isIdentity) return true;
  if (column.columnDefault && /nextval\(/i.test(column.columnDefault)) return true;
  return false;
}

function getSerialBaseType(udtName: string): string {
  switch (udtName) {
    case 'int2': return 'SMALLINT';
    case 'int4': return 'INTEGER';
    case 'int8': return 'BIGINT';
    default: return 'INTEGER';
  }
}

export function mapColumn(column: PgColumn): SnowflakeColumn {
  const isSerial = isSerialColumn(column);

  let snowflakeType: string;
  let comment: string | null = null;

  if (isSerial) {
    snowflakeType = getSerialBaseType(column.udtName);
    comment = column.columnDefault ? `Auto-increment (was: ${column.columnDefault.split('::')[0].trim()})` : null;
  } else {
    const result = mapType(column);
    snowflakeType = result.snowflakeType;
    comment = result.comment;
  }

  // Map column default (excluding serial/identity defaults)
  let defaultValue: string | null = null;
  if (column.columnDefault && !isSerial) {
    defaultValue = mapDefault(column.columnDefault, column.udtName);
  }

  return {
    name: column.columnName,
    type: snowflakeType,
    nullable: column.isNullable,
    defaultValue,
    isIdentity: isSerial,
    identitySeed: 1,
    identityIncrement: 1,
    comment,
  };
}

function mapDefault(pgDefault: string, udtName: string): string | null {
  // Skip sequence defaults
  if (/nextval\(/i.test(pgDefault)) return null;

  // Boolean defaults
  if (pgDefault === 'true' || pgDefault === 'false') return pgDefault.toUpperCase();

  // Current timestamp
  if (pgDefault === 'now()' || pgDefault === 'CURRENT_TIMESTAMP') return 'CURRENT_TIMESTAMP()';
  if (pgDefault === 'CURRENT_DATE') return 'CURRENT_DATE()';

  // Strip type casts (e.g., 'value'::character varying → 'value')
  const stripped = pgDefault.replace(/::[a-zA-Z_ ]+(\[\])?/g, '').trim();
  if (stripped) return stripped;

  return null;
}

export function mapAllColumns(columns: PgColumn[]): SnowflakeColumn[] {
  return columns.map(mapColumn);
}
