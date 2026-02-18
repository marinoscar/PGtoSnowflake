import readline from 'node:readline';
import { REPL_PROMPT } from './constants.js';
import { isInitialized, resolveConfigPaths } from './services/config.service.js';
import { listMappingFiles } from './services/mapping.service.js';
import { runInit } from './commands/init.command.js';
import { runMap } from './commands/map.command.js';
import { runExport } from './commands/export.command.js';
import { runGenerateDDL } from './commands/generate-ddl.command.js';
import { showBanner, showStatusLine, showHelp } from './ui/display.js';
import { logError, logInfo, logBlank } from './ui/logger.js';
import { theme } from './ui/theme.js';
import { setVerbose, isVerbose, initLogFile } from './utils/log-file.js';

export async function startRepl(): Promise<void> {
  // Initialize logging if config exists
  try {
    const paths = await resolveConfigPaths();
    await initLogFile(paths.logsDir);
  } catch {
    // Config not initialized yet — logging will start after init
  }

  // Show banner
  showBanner();

  // Show status
  const initialized = await isInitialized();
  let activeMappings: string[] = [];
  if (initialized) {
    try {
      activeMappings = await listMappingFiles();
    } catch {
      // Ignore
    }
  }
  showStatusLine(initialized, activeMappings.length > 0 ? `${activeMappings.length} mapping(s)` : undefined);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: REPL_PROMPT,
    historySize: 100,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    const [command, ...args] = input.split(/\s+/);

    try {
      switch (command.toLowerCase()) {
        case 'init':
          await runInit();
          // Re-initialize logging after init
          try {
            const paths = await resolveConfigPaths();
            await initLogFile(paths.logsDir);
          } catch {
            // Ignore
          }
          break;

        case 'map':
          await runMap();
          break;

        case 'export':
          await runExport();
          break;

        case 'generate-ddl':
        case 'ddl':
          await runGenerateDDL();
          break;

        case 'help':
          showHelp();
          break;

        case 'verbose': {
          const toggle = args[0]?.toLowerCase();
          if (toggle === 'on') {
            setVerbose(true);
            logInfo('Verbose logging enabled');
          } else if (toggle === 'off') {
            setVerbose(false);
            logInfo('Verbose logging disabled');
          } else {
            logInfo(`Verbose is ${isVerbose() ? 'on' : 'off'}. Use ${theme.command('verbose on')} or ${theme.command('verbose off')}`);
          }
          break;
        }

        case 'status': {
          const init = await isInitialized();
          let mappings: string[] = [];
          if (init) {
            try {
              mappings = await listMappingFiles();
            } catch {
              // Ignore
            }
          }
          showStatusLine(init, mappings.length > 0 ? `${mappings.length} mapping(s)` : undefined);
          break;
        }

        case 'exit':
        case 'quit':
          logBlank();
          logInfo('Goodbye!');
          rl.close();
          process.exit(0);
          break;

        default:
          logError(`Unknown command: ${theme.command(command)}. Type ${theme.command('help')} for available commands.`);
          break;
      }
    } catch (err) {
      if (err instanceof Error) {
        logError(err.message);
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
