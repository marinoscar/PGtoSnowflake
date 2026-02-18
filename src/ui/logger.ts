import figures from 'figures';
import { theme } from './theme.js';

export function logSuccess(message: string): void {
  console.log(`${theme.success(figures.tick)} ${message}`);
}

export function logError(message: string): void {
  console.error(`${theme.error(figures.cross)} ${message}`);
}

export function logWarning(message: string): void {
  console.log(`${theme.warning(figures.warning)} ${message}`);
}

export function logInfo(message: string): void {
  console.log(`${theme.info(figures.info)} ${message}`);
}

export function logStep(message: string): void {
  console.log(`${theme.primary(figures.pointer)} ${message}`);
}

export function logDim(message: string): void {
  console.log(theme.dim(message));
}

export function logBlank(): void {
  console.log();
}
