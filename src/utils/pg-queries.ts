export const QUERY_SCHEMAS = `
  SELECT schema_name AS "schemaName"
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
    AND schema_name NOT LIKE 'pg_temp_%'
    AND schema_name NOT LIKE 'pg_toast_temp_%'
  ORDER BY schema_name;
`;

export const QUERY_TABLES = `
  SELECT table_schema AS "schemaName", table_name AS "tableName"
  FROM information_schema.tables
  WHERE table_type = 'BASE TABLE'
    AND table_schema = $1
  ORDER BY table_name;
`;

export const QUERY_COLUMNS = `
  SELECT
    table_schema AS "schemaName",
    table_name AS "tableName",
    column_name AS "columnName",
    ordinal_position AS "ordinalPosition",
    column_default AS "columnDefault",
    CASE WHEN is_nullable = 'YES' THEN true ELSE false END AS "isNullable",
    data_type AS "dataType",
    udt_name AS "udtName",
    character_maximum_length AS "characterMaximumLength",
    numeric_precision AS "numericPrecision",
    numeric_scale AS "numericScale",
    CASE WHEN is_identity = 'YES' THEN true ELSE false END AS "isIdentity",
    identity_generation AS "identityGeneration"
  FROM information_schema.columns
  WHERE table_schema = $1 AND table_name = $2
  ORDER BY ordinal_position;
`;

export const QUERY_PRIMARY_KEYS = `
  SELECT
    tc.table_schema AS "schemaName",
    tc.table_name AS "tableName",
    tc.constraint_name AS "constraintName",
    kcu.column_name AS "columnName",
    kcu.ordinal_position AS "ordinalPosition"
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = $1
    AND tc.table_name = $2
  ORDER BY kcu.ordinal_position;
`;

export const QUERY_FOREIGN_KEYS = `
  SELECT
    tc.table_schema AS "schemaName",
    tc.table_name AS "tableName",
    tc.constraint_name AS "constraintName",
    kcu.column_name AS "columnName",
    ccu.table_schema AS "referencedSchema",
    ccu.table_name AS "referencedTable",
    ccu.column_name AS "referencedColumn",
    rc.update_rule AS "updateRule",
    rc.delete_rule AS "deleteRule"
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = $1
    AND tc.table_name = $2
  ORDER BY tc.constraint_name, kcu.ordinal_position;
`;

export const QUERY_INDEXES = `
  SELECT
    schemaname AS "schemaName",
    tablename AS "tableName",
    indexname AS "indexName",
    indexdef AS "indexDef"
  FROM pg_indexes
  WHERE schemaname = $1
    AND tablename = $2
    AND indexname NOT IN (
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_type = 'PRIMARY KEY'
        AND table_schema = $1
        AND table_name = $2
    )
  ORDER BY indexname;
`;

export const QUERY_SEQUENCES = `
  SELECT
    s.sequence_schema AS "schemaName",
    s.sequence_name AS "sequenceName",
    s.data_type AS "dataType",
    s.start_value AS "startValue",
    s.increment AS "increment",
    d.refobjid::regclass AS "ownerInfo"
  FROM information_schema.sequences s
  LEFT JOIN pg_depend d
    ON d.objid = (s.sequence_schema || '.' || s.sequence_name)::regclass
    AND d.deptype = 'a'
  WHERE s.sequence_schema = $1
  ORDER BY s.sequence_name;
`;

export const QUERY_DATABASES = `
  SELECT datname AS "databaseName"
  FROM pg_database
  WHERE datistemplate = false
    AND datname != 'postgres'
  ORDER BY datname;
`;
