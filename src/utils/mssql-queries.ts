export const QUERY_SCHEMAS = `
  SELECT s.name AS schemaName
  FROM sys.schemas s
  WHERE s.name NOT IN (
    'db_accessadmin', 'db_backupoperator', 'db_datareader', 'db_datawriter',
    'db_ddladmin', 'db_denydatareader', 'db_denydatawriter', 'db_owner',
    'db_securityadmin', 'guest', 'INFORMATION_SCHEMA', 'sys'
  )
  ORDER BY s.name;
`;

export const QUERY_TABLES = `
  SELECT
    TABLE_SCHEMA AS schemaName,
    TABLE_NAME AS tableName
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE'
    AND TABLE_SCHEMA = @schemaName
  ORDER BY TABLE_NAME;
`;

export const QUERY_COLUMNS = `
  SELECT
    c.TABLE_SCHEMA AS schemaName,
    c.TABLE_NAME AS tableName,
    c.COLUMN_NAME AS columnName,
    c.ORDINAL_POSITION AS ordinalPosition,
    c.COLUMN_DEFAULT AS columnDefault,
    CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS isNullable,
    c.DATA_TYPE AS dataType,
    c.CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
    c.NUMERIC_PRECISION AS numericPrecision,
    c.NUMERIC_SCALE AS numericScale,
    COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS isIdentity,
    IDENT_SEED(c.TABLE_SCHEMA + '.' + c.TABLE_NAME) AS identitySeed,
    IDENT_INCR(c.TABLE_SCHEMA + '.' + c.TABLE_NAME) AS identityIncrement
  FROM INFORMATION_SCHEMA.COLUMNS c
  WHERE c.TABLE_SCHEMA = @schemaName AND c.TABLE_NAME = @tableName
  ORDER BY c.ORDINAL_POSITION;
`;

export const QUERY_PRIMARY_KEYS = `
  SELECT
    tc.TABLE_SCHEMA AS schemaName,
    tc.TABLE_NAME AS tableName,
    tc.CONSTRAINT_NAME AS constraintName,
    kcu.COLUMN_NAME AS columnName,
    kcu.ORDINAL_POSITION AS ordinalPosition
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    AND tc.TABLE_NAME = kcu.TABLE_NAME
  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    AND tc.TABLE_SCHEMA = @schemaName
    AND tc.TABLE_NAME = @tableName
  ORDER BY kcu.ORDINAL_POSITION;
`;

export const QUERY_FOREIGN_KEYS = `
  SELECT
    tc.TABLE_SCHEMA AS schemaName,
    tc.TABLE_NAME AS tableName,
    tc.CONSTRAINT_NAME AS constraintName,
    kcu.COLUMN_NAME AS columnName,
    kcu2.TABLE_SCHEMA AS referencedSchema,
    kcu2.TABLE_NAME AS referencedTable,
    kcu2.COLUMN_NAME AS referencedColumn,
    rc.UPDATE_RULE AS updateRule,
    rc.DELETE_RULE AS deleteRule
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
  JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu2
    ON rc.UNIQUE_CONSTRAINT_NAME = kcu2.CONSTRAINT_NAME
    AND rc.UNIQUE_CONSTRAINT_SCHEMA = kcu2.TABLE_SCHEMA
    AND kcu.ORDINAL_POSITION = kcu2.ORDINAL_POSITION
  WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND tc.TABLE_SCHEMA = @schemaName
    AND tc.TABLE_NAME = @tableName
  ORDER BY tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
`;

export const QUERY_INDEXES = `
  SELECT
    SCHEMA_NAME(o.schema_id) AS schemaName,
    o.name AS tableName,
    i.name AS indexName,
    i.is_unique AS isUnique,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
  FROM sys.indexes i
  JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
  JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
  JOIN sys.objects o ON i.object_id = o.object_id
  WHERE o.type = 'U'
    AND i.is_primary_key = 0
    AND i.type > 0
    AND SCHEMA_NAME(o.schema_id) = @schemaName
    AND o.name = @tableName
  GROUP BY SCHEMA_NAME(o.schema_id), o.name, i.name, i.is_unique
  ORDER BY i.name;
`;

export const QUERY_SEQUENCES = `
  SELECT
    SCHEMA_NAME(s.schema_id) AS schemaName,
    s.name AS sequenceName,
    TYPE_NAME(s.system_type_id) AS dataType,
    CAST(s.start_value AS VARCHAR) AS startValue,
    CAST(s.increment AS VARCHAR) AS increment
  FROM sys.sequences s
  WHERE SCHEMA_NAME(s.schema_id) = @schemaName
  ORDER BY s.name;
`;
