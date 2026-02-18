import boxen from 'boxen';
import Table from 'cli-table3';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../constants.js';
import { theme } from './theme.js';

export function showBanner(): void {
  const banner = boxen(
    `${theme.primary.bold(APP_NAME)} ${theme.muted(`v${APP_VERSION}`)}\n${theme.secondary(APP_DESCRIPTION)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    },
  );
  console.log(banner);
}

export function showStatusLine(initialized: boolean, activeMapping?: string): void {
  const initStatus = initialized
    ? `${theme.success('initialized')}`
    : `${theme.warning('not initialized')} — run ${theme.command('init')} to set up`;
  const mappingStatus = activeMapping
    ? `${theme.value(activeMapping)}`
    : theme.muted('none');

  console.log(`  ${theme.label('Config:')} ${initStatus}  ${theme.label('Mapping:')} ${mappingStatus}`);
  console.log();
}

export function showHelp(): void {
  const commands = [
    ['init', 'Set up encryption key and config directory'],
    ['map', 'Connect to PostgreSQL and create a schema mapping'],
    ['export', 'Export table data to Parquet or CSV via DuckDB'],
    ['generate-ddl', 'Generate Snowflake DDL from a mapping file'],
    ['help', 'Show this help message'],
    ['verbose on|off', 'Toggle verbose logging'],
    ['exit / quit', 'Exit the application'],
  ];

  console.log(theme.label('\n  Available commands:\n'));
  for (const [cmd, desc] of commands) {
    console.log(`    ${theme.command(cmd.padEnd(20))} ${desc}`);
  }
  console.log();
}

export function createTable(headers: string[]): Table.Table {
  return new Table({
    head: headers.map((h) => theme.label(h)),
    style: { head: [], border: [] },
    chars: {
      top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      left: '│', 'left-mid': '├',
      mid: '─', 'mid-mid': '┼',
      right: '│', 'right-mid': '┤',
      middle: '│',
    },
  });
}

export function showSummaryTable(headers: string[], rows: string[][]): void {
  const table = createTable(headers);
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
  console.log();
}
