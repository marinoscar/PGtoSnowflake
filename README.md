# PGtoSnowflake

CLI tool for migrating PostgreSQL databases to Snowflake. Interactively map schemas and tables, export data to Parquet/CSV via DuckDB, and generate Snowflake-compatible DDL scripts.

## Features

- **Interactive REPL** — run `pgtosnowflake` and use commands in a persistent session
- **Schema mapping** — connect to PostgreSQL, browse schemas/tables, save encrypted mapping files
- **Data export** — export tables to Parquet (ZSTD compressed) or CSV using DuckDB's PostgreSQL extension
- **DDL generation** — generate Snowflake `CREATE SCHEMA`, `CREATE TABLE`, and `ALTER TABLE` statements with correct type mappings
- **Encryption** — AES-256-GCM encryption for database passwords in mapping files
- **Logging** — file-based session logs for troubleshooting

## Prerequisites

- Node.js 20+
- Access to a PostgreSQL database
- (Optional) Snowflake account for deploying generated DDL

## Installation

### From source

```bash
git clone <repo-url>
cd PGtoSnowflake
npm install
npm run build
```

Then run directly:

```bash
node dist/index.js
```

Or link globally:

```bash
npm link
pgtosnowflake
```

## Quick Start

1. Launch the interactive REPL:

   ```bash
   pgtosnowflake
   ```

2. Initialize encryption config:

   ```
   pg2sf > init
   ```

   Choose local (project) or global (home directory) config, then auto-generate a key or enter a passphrase.

3. Map a PostgreSQL database:

   ```
   pg2sf > map
   ```

   Enter connection details, select schemas and tables. The mapping (with encrypted password) is saved to `.pgtosnowflake/mappings/`.

4. Export data:

   ```
   pg2sf > export
   ```

   Select a mapping file, choose Parquet or CSV, and DuckDB exports each table.

5. Generate Snowflake DDL:

   ```
   pg2sf > generate-ddl
   ```

   Select a mapping and the tool writes a `.sql` file with `CREATE SCHEMA`, `CREATE TABLE`, primary keys, and foreign key constraints.

## Subcommand Usage

All commands can also be run directly from the shell:

```bash
pgtosnowflake init
pgtosnowflake map --host localhost --port 5432 --database mydb --user postgres
pgtosnowflake export --mapping my-project --format parquet
pgtosnowflake generate-ddl --mapping my-project --output snowflake.sql
pgtosnowflake generate-ddl --mapping my-project --preview
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--verbose` | Enable debug-level logging to console |
| `--version` | Show version |
| `--help` | Show help |

### `map` Flags

| Flag | Description |
|------|-------------|
| `-H, --host <host>` | PostgreSQL host |
| `-p, --port <port>` | PostgreSQL port |
| `-d, --database <db>` | Database name |
| `-U, --user <user>` | Username |
| `-W, --password <pw>` | Password |
| `-s, --ssl` | Use SSL |

### `export` Flags

| Flag | Description |
|------|-------------|
| `-m, --mapping <name>` | Mapping file name or path |
| `-t, --tables <list>` | Comma-separated table filter |
| `-f, --format <fmt>` | `parquet` or `csv` |
| `-o, --output-dir <dir>` | Output directory |

### `generate-ddl` Flags

| Flag | Description |
|------|-------------|
| `-m, --mapping <name>` | Mapping file name or path |
| `-o, --output <file>` | Output SQL file path |
| `--preview` | Print DDL to stdout |

## Configuration

The `.pgtosnowflake/` directory contains:

```
.pgtosnowflake/
  key                  # AES-256-GCM encryption key (hex)
  mappings/            # Mapping JSON files
  logs/                # Session log files
```

Config is resolved in order: local (`./.pgtosnowflake/`) then global (`~/.pgtosnowflake/`).

## Troubleshooting

- **Log files**: check `.pgtosnowflake/logs/` for detailed session logs
- **Verbose mode**: pass `--verbose` or type `verbose on` in the REPL
- **Connection issues**: verify host, port, and credentials; check PostgreSQL `pg_hba.conf` for client access
- **DuckDB errors**: ensure the `@duckdb/node-api` package installed correctly for your platform
- **Encryption key errors**: make sure `.pgtosnowflake/key` exists and matches the key used when mapping was created

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more details.

## Development

```bash
npm run dev          # Run with tsx (no build needed)
npm run build        # Compile TypeScript
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```

## License

MIT
