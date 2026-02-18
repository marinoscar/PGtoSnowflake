# Command Reference

## Interactive REPL

Run `pgtosnowflake` with no arguments to start the interactive session.

```
pg2sf > help
```

Available REPL commands:

| Command | Description |
|---------|-------------|
| `init` | Set up encryption key and config directory |
| `map` | Connect to PostgreSQL and create a schema mapping |
| `export` | Export table data to Parquet or CSV via DuckDB |
| `generate-ddl` | Generate Snowflake DDL from a mapping file |
| `help` | Show available commands |
| `verbose on\|off` | Toggle verbose debug logging |
| `status` | Show current config and mapping status |
| `exit` / `quit` | Exit the application |

## `init`

Sets up the `.pgtosnowflake/` configuration directory and encryption key.

### Flow

1. Choose config location: local (current directory) or global (home directory)
2. If config already exists, confirm overwrite
3. Choose key generation: auto-generate random 256-bit key or derive from passphrase
4. Creates `.pgtosnowflake/` with `key`, `mappings/`, and `logs/` subdirectories

### Notes

- For local config, add `.pgtosnowflake/` to `.gitignore` to protect your encryption key
- The encryption key is used only for the `password` field in mapping files

## `map`

Connects to PostgreSQL, lets you interactively select schemas and tables, introspects metadata, and saves an encrypted mapping file.

### CLI Flags

```bash
pgtosnowflake map [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-H, --host <host>` | PostgreSQL host | `localhost` |
| `-p, --port <port>` | PostgreSQL port | `5432` |
| `-d, --database <db>` | Database name | (prompted) |
| `-U, --user <user>` | Username | `postgres` |
| `-W, --password <pw>` | Password | (prompted) |
| `-s, --ssl` | Use SSL connection | `false` |

### Flow

1. Verify `init` has been run
2. Prompt for or use CLI-provided connection details
3. Connect to PostgreSQL
4. List schemas (checkbox selection, `public` pre-checked)
5. List tables per schema (checkbox selection, all pre-checked)
6. Introspect each selected table (columns, PKs, FKs, indexes, sequences)
7. Display summary table
8. Prompt for mapping name and default export format
9. Save mapping to `.pgtosnowflake/mappings/<name>.mapping.json`

### Mapping File Structure

The mapping file is JSON with all fields in plaintext except the password:

```json
{
  "version": 1,
  "name": "my-project",
  "createdAt": "2026-02-17T...",
  "source": {
    "connection": {
      "host": "localhost",
      "port": 5432,
      "database": "mydb",
      "user": "postgres",
      "password": {
        "encrypted": true,
        "algorithm": "aes-256-gcm",
        "iv": "...",
        "tag": "...",
        "ciphertext": "..."
      },
      "ssl": false
    }
  },
  "selectedSchemas": ["public"],
  "tables": [...],
  "exportOptions": { "format": "parquet", "outputDir": "./export" }
}
```

## `export`

Reads a mapping file and exports table data to Parquet or CSV using DuckDB.

### CLI Flags

```bash
pgtosnowflake export [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-m, --mapping <name>` | Mapping file name or path | (prompted) |
| `-t, --tables <list>` | Comma-separated table filter | all tables |
| `-f, --format <fmt>` | `parquet` or `csv` | mapping default |
| `-o, --output-dir <dir>` | Output directory | mapping default or `./export` |

### Flow

1. Load and decrypt mapping file
2. Optionally filter tables
3. Determine format (flag > mapping default > prompt)
4. For each table, use DuckDB to `COPY` data from PostgreSQL
5. Display summary with row counts, durations, and file sizes

### Output

- Parquet files: ZSTD compressed, one file per table
- CSV files: with header row, one file per table
- File naming: `<schema>.<table>.<format>` (e.g., `public.users.parquet`)

## `generate-ddl`

Reads a mapping file and generates Snowflake-compatible DDL.

### CLI Flags

```bash
pgtosnowflake generate-ddl [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-m, --mapping <name>` | Mapping file name or path | (prompted) |
| `-o, --output <file>` | Output SQL file | `<mapping-name>-snowflake.sql` |
| `--preview` | Print DDL to stdout | `false` |

### Flow

1. Load mapping file
2. Generate DDL with type mappings, PKs, FKs, identity columns
3. Show preview (schema count, table count, FK count)
4. Write to `.sql` file or stdout

### DDL Output Includes

- `CREATE SCHEMA IF NOT EXISTS` for each schema
- `CREATE TABLE IF NOT EXISTS` with columns, types, NOT NULL, DEFAULT, IDENTITY
- `PRIMARY KEY` inline in CREATE TABLE
- `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` after all tables
- Column comments for unmapped or special types
- Header comment noting Snowflake's declarative constraint behavior

### Type Mapping

| PostgreSQL | Snowflake | Notes |
|------------|-----------|-------|
| `int2` | `SMALLINT` | |
| `int4` / `serial` | `INTEGER` | serial → `IDENTITY(1,1)` |
| `int8` / `bigserial` | `BIGINT` | bigserial → `IDENTITY(1,1)` |
| `numeric(p,s)` | `NUMBER(p,s)` | |
| `varchar(n)` | `VARCHAR(n)` | |
| `text` | `VARCHAR` | |
| `boolean` | `BOOLEAN` | |
| `timestamp` | `TIMESTAMP_NTZ` | |
| `timestamptz` | `TIMESTAMP_TZ` | |
| `json` / `jsonb` | `VARIANT` | |
| `bytea` | `BINARY` | |
| `uuid` | `VARCHAR(36)` | |
| `interval` | `VARCHAR` | comment added |
| `_type` (arrays) | `ARRAY` | comment added |
| USER-DEFINED | `VARCHAR` | comment added |
