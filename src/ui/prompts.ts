import { input, password, confirm, select, checkbox } from '@inquirer/prompts';

export async function promptInput(message: string, defaultValue?: string, validate?: (input: string) => string | true): Promise<string> {
  return input({
    message,
    default: defaultValue,
    validate,
  });
}

export async function promptPassword(message: string): Promise<string> {
  return password({
    message,
    mask: '*',
  });
}

export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
  });
}

export async function promptSelect<T extends string>(
  message: string,
  choices: { name: string; value: T; description?: string }[],
): Promise<T> {
  return select({
    message,
    choices,
  });
}

export async function promptCheckbox<T extends string>(
  message: string,
  choices: { name: string; value: T; checked?: boolean }[],
): Promise<T[]> {
  return checkbox({
    message,
    choices,
  });
}
