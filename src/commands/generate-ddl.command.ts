import path from 'node:path';
import { isInitialized } from '../services/config.service.js';
import { listMappingFiles, loadMappingFile, loadMappingFileByPath } from '../services/mapping.service.js';
import { generateDDL } from '../services/ddl-generator.service.js';
import { promptSelect, promptInput, promptConfirm } from '../ui/prompts.js';
import { startSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { logSuccess, logError, logInfo, logStep, logBlank } from '../ui/logger.js';
import { theme } from '../ui/theme.js';
import { writeTextFile } from '../utils/file.js';
import { logInfo as fileLogInfo, logError as fileLogError } from '../utils/log-file.js';

interface GenerateDDLCommandOptions {
  mapping?: string;
  output?: string;
  preview?: boolean;
}

export async function runGenerateDDL(options: GenerateDDLCommandOptions = {}): Promise<void> {
  // 1. Verify init
  const initialized = await isInitialized();
  if (!initialized) {
    logError('Configuration not found. Run "init" first.');
    return;
  }

  logStep('Snowflake DDL Generation');
  logBlank();

  // 2. Load mapping
  let mapping;
  try {
    if (options.mapping) {
      if (options.mapping.includes(path.sep) || options.mapping.includes('/') || options.mapping.endsWith('.json')) {
        mapping = await loadMappingFileByPath(options.mapping);
      } else {
        mapping = await loadMappingFile(options.mapping);
      }
    } else {
      const mappingNames = await listMappingFiles();
      if (mappingNames.length === 0) {
        logError('No mapping files found. Run "map" first to create one.');
        return;
      }
      const selectedName = await promptSelect(
        'Select a mapping file:',
        mappingNames.map((n) => ({ name: n, value: n })),
      );
      mapping = await loadMappingFile(selectedName);
    }
  } catch (err) {
    if (err instanceof Error) logError(err.message);
    return;
  }

  // 3. Generate DDL
  startSpinner(`Generating DDL for ${mapping.tables.length} tables...`);

  let result;
  try {
    result = await generateDDL(mapping.tables);
    succeedSpinner('DDL generated successfully');
  } catch (err) {
    failSpinner('Failed to generate DDL');
    if (err instanceof Error) logError(err.message);
    await fileLogError('generate-ddl', 'DDL generation failed', err instanceof Error ? err : undefined);
    return;
  }

  // 4. Preview info
  logBlank();
  logInfo(`  Schemas: ${theme.value(String(result.schemaCount))}`);
  logInfo(`  Tables:  ${theme.value(String(result.tableCount))}`);
  logInfo(`  Foreign Keys: ${theme.value(String(result.foreignKeyCount))}`);
  logBlank();

  // 5. Output
  if (options.preview) {
    console.log(result.sql);
  } else {
    const defaultOutput = `${mapping.name}-snowflake.sql`;
    const outputFile = options.output || await promptInput('Output file:', defaultOutput);

    await writeTextFile(outputFile, result.sql);
    await fileLogInfo('generate-ddl', `DDL written to ${outputFile}`);

    logSuccess(`DDL written to ${theme.path(outputFile)}`);
  }

  logBlank();
}
