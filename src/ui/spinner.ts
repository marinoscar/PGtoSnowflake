import ora, { type Ora } from 'ora';
import { theme } from './theme.js';

let activeSpinner: Ora | null = null;

export function startSpinner(text: string): Ora {
  stopSpinner();
  activeSpinner = ora({
    text: theme.info(text),
    spinner: 'dots',
  }).start();
  return activeSpinner;
}

export function updateSpinner(text: string): void {
  if (activeSpinner) {
    activeSpinner.text = theme.info(text);
  }
}

export function succeedSpinner(text: string): void {
  if (activeSpinner) {
    activeSpinner.succeed(theme.success(text));
    activeSpinner = null;
  }
}

export function failSpinner(text: string): void {
  if (activeSpinner) {
    activeSpinner.fail(theme.error(text));
    activeSpinner = null;
  }
}

export function warnSpinner(text: string): void {
  if (activeSpinner) {
    activeSpinner.warn(theme.warning(text));
    activeSpinner = null;
  }
}

export function stopSpinner(): void {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
}
