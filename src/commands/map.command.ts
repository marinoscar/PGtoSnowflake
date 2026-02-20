import type { SourceConnectionConfig, SourceTableMetadata } from '../types/source-engine.js';
import type { SourceEngine } from '../types/source-engine.js';
import type { MappingFile, MappingExportOptions } from '../types/mapping.js';
import { MAPPING_FILE_VERSION, DEFAULT_EXPORT_FORMAT, DEFAULT_OUTPUT_DIR } from '../constants.js';
import { isInitialized } from '../services/config.service.js';
import { encryptPassword, saveMappingFile } from '../services/mapping.service.js';
import { listConnections, loadConnection, decryptConnectionPassword, saveConnection } from '../services/connection.service.js';
import { getAdapter, getEngineDisplayName, getDefaultPort, getDefaultUser } from '../services/adapter-factory.js';
import type { SourceAdapter } from '../services/source-adapter.js';
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

async function selectEngine(): Promise<SourceEngine> {
  return promptSelect<SourceEngine>(
    'Source database engine:',
    [
      { name: 'PostgreSQL', value: 'postgresql' },
      { name: 'MySQL', value: 'mysql' },
      { name: 'SQL Server', value: 'mssql' },
    ],
  );
}

async function gatherConnection(engine: SourceEngine, options: MapCommandOptions): Promise<SourceConnectionConfig> {
  const displayName = getEngineDisplayName(engine);
  const defaultPort = getDefaultPort(engine);
  const defaultUser = getDefaultUser(engine);

  // Check for saved connections
  let savedNames: string[] = [];
  try {
    savedNames = await listConnections();
  } catch {
    // No connections directory yet — that's fine
  }

  // Filter to connections that match the selected engine (or have no engine = old PG connections)
  if (savedNames.length > 0) {
    const connectionChoice = await promptSelect<string>(
      'Connection:',
      [
        { name: 'New connection', value: '__new__' },
        ...savedNames.map((n) => ({ name: n, value: n })),
      ],
    );

    if (connectionChoice !== '__new__') {
      const saved = await loadConnection(connectionChoice);
      const decryptedPassword = await decryptConnectionPassword(saved);

      // Allow overriding the database
      const database = await promptInput('Database name:', saved.database, validateNonEmpty);

      const config: SourceConnectionConfig = {
        engine,
        host: saved.host,
        port: saved.port,
        database,
        user: saved.user,
        password: decryptedPassword,
        ssl: saved.ssl,
      };

      // Carry over MSSQL-specific fields
      if (engine === 'mssql') {
        if (saved.instanceName) config.instanceName = saved.instanceName;
        if (saved.trustServerCertificate !== undefined) config.trustServerCertificate = saved.trustServerCertificate;
      }

      return config;
    }
  }

  // New connection flow
  const host = options.host || await promptInput(`${displayName} host:`, 'localhost', validateHostInput);
  const portStr = options.port?.toString() || await promptInput(`${displayName} port:`, String(defaultPort), validatePortInput);
  const port = parseInt(portStr, 10);
  const database = options.database || await promptInput('Database name:', undefined, validateNonEmpty);
  const user = options.user || await promptInput('Username:', defaultUser, validateNonEmpty);
  const password = options.password || await promptPassword('Password:');
  const ssl = options.ssl ?? await promptConfirm('Use SSL?', false);

  const config: SourceConnectionConfig = { engine, host, port, database, user, password, ssl };

  // MSSQL-specific prompts
  if (engine === 'mssql') {
    const instanceName = await promptInput('Instance name (leave blank for default):', '');
    if (instanceName) config.instanceName = instanceName;
    config.trustServerCertificate = await promptConfirm('Trust server certificate?', true);
  }

  return config;
}

async function offerSaveConnection(config: SourceConnectionConfig): Promise<void> {
  try {
    const shouldSave = await promptConfirm('Save this connection for future use?', false);
    if (shouldSave) {
      const connName = await promptInput('Connection name:', `${config.host}-${config.database}`, validateMappingName);
      const filePath = await saveConnection(connName, config);
      logSuccess(`Connection saved as ${theme.value(connName)}`);
      logInfo(`  ${theme.path(filePath)}`);
    }
  } catch {
    // If save fails (e.g. ESC or Ctrl+C), just continue silently
  }
}

export async function runMap(options: MapCommandOptions = {}): Promise<void> {
  // 1. Verify init
  const initialized = await isInitialized();
  if (!initialized) {
    logError('Configuration not found. Run "init" first.');
    return;
  }

  logStep('Source Schema Mapping');
  logBlank();

  // 2. Select engine
  const engine = await selectEngine();
  const adapter = await getAdapter(engine);
  const displayName = getEngineDisplayName(engine);

  // 3. Gather connection details
  const config = await gatherConnection(engine, options);

  // 4. Connect
  startSpinner(`Connecting to ${config.host}:${config.port}/${config.database}...`);
  try {
    await adapter.connect(config);
    succeedSpinner(`Connected to ${config.host}:${config.port}/${config.database}`);
  } catch (err) {
    failSpinner(`Failed to connect to ${config.host}:${config.port}/${config.database}`);
    if (err instanceof Error) logError(err.message);
    return;
  }

  // 4b. Offer to save connection
  await offerSaveConnection(config);

  try {
    // 5. List and select schemas
    let selectedSchemas: string[];

    if (adapter.supportsSchemas) {
      startSpinner('Fetching schemas...');
      const schemas = await adapter.getSchemas();
      succeedSpinner(`Found ${schemas.length} schemas`);

      if (schemas.length === 0) {
        logWarning('No user schemas found in this database.');
        return;
      }

      selectedSchemas = await promptCheckbox(
        'Select schemas to include:',
        schemas.map((s) => ({
          name: s.schemaName,
          value: s.schemaName,
          checked: s.schemaName === 'public' || s.schemaName === 'dbo',
        })),
      );

      if (selectedSchemas.length === 0) {
        logWarning('No schemas selected. Aborting.');
        return;
      }
    } else {
      // MySQL: database = single schema
      selectedSchemas = [config.database];
      logInfo(`Using database ${theme.value(config.database)} as schema`);
    }

    // 6. List and select tables per schema
    const allSelectedTables: { schemaName: string; tableName: string }[] = [];

    for (const schemaName of selectedSchemas) {
      startSpinner(`Fetching tables for ${schemaName}...`);
      const tables = await adapter.getTables(schemaName);
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

    // 7. Introspect tables
    startSpinner(`Introspecting ${allSelectedTables.length} tables...`);
    const tablesBySchema = new Map<string, string[]>();
    for (const t of allSelectedTables) {
      const existing = tablesBySchema.get(t.schemaName) || [];
      existing.push(t.tableName);
      tablesBySchema.set(t.schemaName, existing);
    }

    const allMetadata: SourceTableMetadata[] = [];
    for (const [schemaName, tableNames] of tablesBySchema) {
      const metadata = await adapter.introspectSchema(schemaName, tableNames);
      allMetadata.push(...metadata);
    }
    succeedSpinner(`Introspected ${allMetadata.length} tables`);

    // 8. Display summary
    logBlank();
    const summaryRows = allMetadata.map((t) => [
      t.schemaName,
      t.tableName,
      String(t.columns.length),
      t.primaryKey ? t.primaryKey.columns.join(', ') : '-',
      String(t.foreignKeys.length),
    ]);
    showSummaryTable(['Schema', 'Table', 'Columns', 'Primary Key', 'FKs'], summaryRows);

    // 9. Mapping name and export format
    const mappingName = await promptInput('Mapping name:', config.database, validateMappingName);

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

    // 10. Encrypt password and save
    startSpinner('Saving mapping file...');

    const encryptedPassword = await encryptPassword(config.password);

    const mapping: MappingFile = {
      version: MAPPING_FILE_VERSION,
      name: mappingName,
      createdAt: new Date().toISOString(),
      source: {
        engine,
        connection: {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: encryptedPassword,
          ssl: config.ssl,
          ...(config.instanceName ? { instanceName: config.instanceName } : {}),
          ...(config.trustServerCertificate !== undefined ? { trustServerCertificate: config.trustServerCertificate } : {}),
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
    logInfo(`  ${allMetadata.length} tables across ${selectedSchemas.length} schemas (${displayName})`);
    logBlank();
  } catch (err) {
    await fileLogError('map', 'Mapping failed', err instanceof Error ? err : undefined);
    throw err;
  } finally {
    await adapter.disconnect();
  }
}
