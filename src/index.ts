#!/usr/bin/env node

import { Command } from 'commander';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from './constants.js';
import { runInit } from './commands/init.command.js';
import { runMap } from './commands/map.command.js';
import { runExport } from './commands/export.command.js';
import { runGenerateDDL } from './commands/generate-ddl.command.js';
import { startRepl } from './repl.js';
import { setVerbose, initLogFile } from './utils/log-file.js';
import { resolveConfigPaths } from './services/config.service.js';

const program = new Command();

program
  .name(APP_NAME)
  .version(APP_VERSION)
  .description(APP_DESCRIPTION)
  .option('--verbose', 'Enable verbose logging')
  .hook('preAction', async (thisCommand) => {
    if (thisCommand.opts().verbose) {
      setVerbose(true);
    }
    try {
      const paths = await resolveConfigPaths();
      await initLogFile(paths.logsDir);
    } catch {
      // Config not initialized yet
    }
  });

program
  .command('init')
  .description('Initialize encryption key and config directory')
  .action(async () => {
    await runInit();
  });

program
  .command('map')
  .description('Connect to PostgreSQL and create a schema mapping')
  .option('-H, --host <host>', 'PostgreSQL host')
  .option('-p, --port <port>', 'PostgreSQL port', parseInt)
  .option('-d, --database <database>', 'Database name')
  .option('-U, --user <user>', 'Username')
  .option('-W, --password <password>', 'Password')
  .option('-s, --ssl', 'Use SSL connection')
  .action(async (options) => {
    await runMap(options);
  });

program
  .command('export')
  .description('Export table data to Parquet or CSV via DuckDB')
  .option('-m, --mapping <name>', 'Mapping file name or path')
  .option('-t, --tables <tables>', 'Comma-separated list of tables to export')
  .option('-f, --format <format>', 'Export format (parquet or csv)')
  .option('-o, --output-dir <dir>', 'Output directory')
  .action(async (options) => {
    await runExport(options);
  });

program
  .command('generate-ddl')
  .description('Generate Snowflake DDL from a mapping file')
  .option('-m, --mapping <name>', 'Mapping file name or path')
  .option('-o, --output <file>', 'Output SQL file path')
  .option('--preview', 'Print DDL to stdout instead of file')
  .action(async (options) => {
    await runGenerateDDL(options);
  });

// If no arguments, start REPL
if (process.argv.length <= 2) {
  startRepl();
} else {
  program.parse();
}
