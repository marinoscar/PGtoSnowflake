import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_LOG_FILES } from '../constants.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let logFilePath: string | null = null;
let currentLogLevel: LogLevel = 'INFO';
let verboseToConsole = false;

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function setVerbose(enabled: boolean): void {
  verboseToConsole = enabled;
  if (enabled) {
    currentLogLevel = 'DEBUG';
  }
}

export function isVerbose(): boolean {
  return verboseToConsole;
}

export async function initLogFile(logsDir: string): Promise<void> {
  await fs.mkdir(logsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  logFilePath = path.join(logsDir, `pgtosnowflake-${timestamp}.log`);

  await rotateLogFiles(logsDir);
}

async function rotateLogFiles(logsDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(logsDir);
    const logFiles = entries
      .filter((e) => e.startsWith('pgtosnowflake-') && e.endsWith('.log'))
      .sort()
      .reverse();

    if (logFiles.length > MAX_LOG_FILES) {
      const toDelete = logFiles.slice(MAX_LOG_FILES);
      await Promise.all(
        toDelete.map((f) => fs.unlink(path.join(logsDir, f)).catch(() => {})),
      );
    }
  } catch {
    // Ignore rotation errors
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

export async function log(level: LogLevel, context: string, message: string): Promise<void> {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] [${context}] ${message}\n`;

  if (logFilePath) {
    try {
      await fs.appendFile(logFilePath, entry, 'utf-8');
    } catch {
      // Ignore file write errors
    }
  }

  if (verboseToConsole) {
    const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : level === 'DEBUG' ? '\x1b[90m' : '\x1b[36m';
    process.stderr.write(`${color}${entry}\x1b[0m`);
  }
}

export async function logDebug(context: string, message: string): Promise<void> {
  return log('DEBUG', context, message);
}

export async function logInfo(context: string, message: string): Promise<void> {
  return log('INFO', context, message);
}

export async function logWarn(context: string, message: string): Promise<void> {
  return log('WARN', context, message);
}

export async function logError(context: string, message: string, error?: Error): Promise<void> {
  let msg = message;
  if (error) {
    msg += `\n  Error: ${error.message}`;
    if (error.stack) {
      msg += `\n  Stack: ${error.stack}`;
    }
  }
  return log('ERROR', context, msg);
}

export function getLogFilePath(): string | null {
  return logFilePath;
}
