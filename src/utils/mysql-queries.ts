export const QUERY_TABLES = `
  SELECT
    TABLE_SCHEMA AS schemaName,
    TABLE_NAME AS tableName
  FROM information_schema.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE'
    AND TABLE_SCHEMA = ?
  ORDER BY TABLE_NAME;
`;

export const QUERY_COLUMNS = `
  SELECT
    TABLE_SCHEMA AS schemaName,
    TABLE_NAME AS tableName,
    COLUMN_NAME AS columnName,
    ORDINAL_POSITION AS ordinalPosition,
    COLUMN_DEFAULT AS columnDefault,
    CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS isNullable,
    DATA_TYPE AS dataType,
    COLUMN_TYPE AS columnType,
    CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
    NUMERIC_PRECISION AS numericPrecision,
    NUMERIC_SCALE AS numericScale,
    CASE WHEN EXTRA LIKE '%auto_increment%' THEN 1 ELSE 0 END AS isIdentity
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
  ORDER BY ORDINAL_POSITION;
`;

export const QUERY_PRIMARY_KEYS = `
  SELECT
    tc.TABLE_SCHEMA AS schemaName,
    tc.TABLE_NAME AS tableName,
    tc.CONSTRAINT_NAME AS constraintName,
    kcu.COLUMN_NAME AS columnName,
    kcu.ORDINAL_POSITION AS ordinalPosition
  FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    AND tc.TABLE_NAME = kcu.TABLE_NAME
  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    AND tc.TABLE_SCHEMA = ?
    AND tc.TABLE_NAME = ?
  ORDER BY kcu.ORDINAL_POSITION;
`;

export const QUERY_FOREIGN_KEYS = `
  SELECT
    tc.TABLE_SCHEMA AS schemaName,
    tc.TABLE_NAME AS tableName,
    tc.CONSTRAINT_NAME AS constraintName,
    kcu.COLUMN_NAME AS columnName,
    kcu.REFERENCED_TABLE_SCHEMA AS referencedSchema,
    kcu.REFERENCED_TABLE_NAME AS referencedTable,
    kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
    rc.UPDATE_RULE AS updateRule,
    rc.DELETE_RULE AS deleteRule
  FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    AND tc.TABLE_NAME = kcu.TABLE_NAME
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
  WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND tc.TABLE_SCHEMA = ?
    AND tc.TABLE_NAME = ?
  ORDER BY tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
`;

export const QUERY_INDEXES = `
  SELECT
    TABLE_SCHEMA AS schemaName,
    TABLE_NAME AS tableName,
    INDEX_NAME AS indexName,
    CASE WHEN NON_UNIQUE = 0 THEN 1 ELSE 0 END AS isUnique,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = ?
    AND TABLE_NAME = ?
    AND INDEX_NAME != 'PRIMARY'
  GROUP BY TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, NON_UNIQUE
  ORDER BY INDEX_NAME;
`;
