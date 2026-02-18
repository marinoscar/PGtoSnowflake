import type { PgConnectionConfig, PgTable, PgTableMetadata } from '../types/postgres.js';
import type { MappingFile, MappingExportOptions } from '../types/mapping.js';
import { MAPPING_FILE_VERSION, DEFAULT_PG_PORT, DEFAULT_EXPORT_FORMAT, DEFAULT_OUTPUT_DIR } from '../constants.js';
import { isInitialized } from '../services/config.service.js';
import { encryptPassword, saveMappingFile } from '../services/mapping.service.js';
import * as pgService from '../services/postgres.service.js';
import { promptInput, promptPassword, promptConfirm, promptSelect, promptCheckbox } from '../ui/prompts.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { logSuccess, logError, logWarning, logInfo, logStep, logBlank } from '../ui/logger.js';
import { showSummaryTable } from '../ui/display.js';
import { theme } from '../ui/theme.js';
import { validateHostInput, validateNonEmpty, validatePortInput, validateMappingName } from '../utils/validation.js';
import { logInfo as fileLogInfo, logError as fileLogError } from '../utils/log-file.js';

interface MapCommandOptions {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export async function runMap(options: MapCommandOptions = {}): Promise<void> {
  // 1. Verify init
  const initialized = await isInitialized();
  if (!initialized) {
    logError('Configuration not found. Run "init" first.');
    return;
  }

  logStep('PostgreSQL Schema Mapping');
  logBlank();

  // 2. Gather connection details
  const host = options.host || await promptInput('PostgreSQL host:', 'localhost', validateHostInput);
  const portStr = options.port?.toString() || await promptInput('PostgreSQL port:', String(DEFAULT_PG_PORT), validatePortInput);
  const port = parseInt(portStr, 10);
  const database = options.database || await promptInput('Database name:', undefined, validateNonEmpty);
  const user = options.user || await promptInput('Username:', 'postgres', validateNonEmpty);
  const password = options.password || await promptPassword('Password:');
  const ssl = options.ssl ?? await promptConfirm('Use SSL?', false);

  const config: PgConnectionConfig = { host, port, database, user, password, ssl };

  // 3. Connect
  startSpinner(`Connecting to ${host}:${port}/${database}...`);
  try {
    await pgService.connect(config);
    succeedSpinner(`Connected to ${host}:${port}/${database}`);
  } catch (err) {
    failSpinner(`Failed to connect to ${host}:${port}/${database}`);
    if (err instanceof Error) logError(err.message);
    return;
  }

  try {
    // 4. List schemas
    startSpinner('Fetching schemas...');
    const schemas = await pgService.getSchemas();
    succeedSpinner(`Found ${schemas.length} schemas`);

    if (schemas.length === 0) {
      logWarning('No user schemas found in this database.');
      return;
    }

    const selectedSchemas = await promptCheckbox(
      'Select schemas to include:',
      schemas.map((s) => ({
        name: s.schemaName,
        value: s.schemaName,
        checked: s.schemaName === 'public',
      })),
    );

    if (selectedSchemas.length === 0) {
      logWarning('No schemas selected. Aborting.');
      return;
    }

    // 5. List and select tables per schema
    const allSelectedTables: PgTable[] = [];

    for (const schemaName of selectedSchemas) {
      startSpinner(`Fetching tables for ${schemaName}...`);
      const tables = await pgService.getTables(schemaName);
      succeedSpinner(`Found ${tables.length} tables in ${schemaName}`);

      if (tables.length === 0) {
        logInfo(`No tables found in schema ${theme.value(schemaName)}`);
        continue;
      }

      const selectedTableNames = await promptCheckbox(
        `Select tables from ${schemaName}:`,
        tables.map((t) => ({
          name: t.tableName,
          value: t.tableName,
          checked: true,
        })),
      );

      for (const tableName of selectedTableNames) {
        allSelectedTables.push({ schemaName, tableName });
      }
    }

    if (allSelectedTables.length === 0) {
      logWarning('No tables selected. Aborting.');
      return;
    }

    // 6. Introspect tables
    startSpinner(`Introspecting ${allSelectedTables.length} tables...`);
    const tablesBySchema = new Map<string, string[]>();
    for (const t of allSelectedTables) {
      const existing = tablesBySchema.get(t.schemaName) || [];
      existing.push(t.tableName);
      tablesBySchema.set(t.schemaName, existing);
    }

    const allMetadata: PgTableMetadata[] = [];
    for (const [schemaName, tableNames] of tablesBySchema) {
      const metadata = await pgService.introspectSchema(schemaName, tableNames);
      allMetadata.push(...metadata);
    }
    succeedSpinner(`Introspected ${allMetadata.length} tables`);

    // 7. Display summary
    logBlank();
    const summaryRows = allMetadata.map((t) => [
      t.schemaName,
      t.tableName,
      String(t.columns.length),
      t.primaryKey ? t.primaryKey.columns.join(', ') : '-',
      String(t.foreignKeys.length),
    ]);
    showSummaryTable(['Schema', 'Table', 'Columns', 'Primary Key', 'FKs'], summaryRows);

    // 8. Mapping name and export format
    const mappingName = await promptInput('Mapping name:', database, validateMappingName);

    const exportFormat = await promptSelect<'parquet' | 'csv'>(
      'Default export format:',
      [
        { name: 'Parquet (recommended)', value: 'parquet' },
        { name: 'CSV', value: 'csv' },
      ],
    );

    const outputDir = await promptInput('Export output directory:', DEFAULT_OUTPUT_DIR);

    const exportOptions: MappingExportOptions = {
      format: exportFormat || DEFAULT_EXPORT_FORMAT,
      outputDir,
    };

    // 9. Encrypt password and save
    startSpinner('Saving mapping file...');

    const encryptedPassword = await encryptPassword(password);

    const mapping: MappingFile = {
      version: MAPPING_FILE_VERSION,
      name: mappingName,
      createdAt: new Date().toISOString(),
      source: {
        connection: {
          host,
          port,
          database,
          user,
          password: encryptedPassword,
          ssl,
        },
      },
      selectedSchemas,
      tables: allMetadata,
      exportOptions,
    };

    const filePath = await saveMappingFile(mapping);
    succeedSpinner('Mapping file saved');

    await fileLogInfo('map', `Mapping saved to ${filePath}`);

    logBlank();
    logSuccess(`Mapping saved to ${theme.path(filePath)}`);
    logInfo(`  ${allMetadata.length} tables across ${selectedSchemas.length} schemas`);
    logBlank();
  } catch (err) {
    await fileLogError('map', 'Mapping failed', err instanceof Error ? err : undefined);
    if (err instanceof Error) logError(err.message);
  } finally {
    await pgService.disconnect();
  }
}
