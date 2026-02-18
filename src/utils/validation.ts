export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isValidHost(host: string): boolean {
  if (!host || host.trim().length === 0) return false;
  // Allow hostnames, IPs, and localhost
  const hostRegex = /^[a-zA-Z0-9._-]+$/;
  return hostRegex.test(host);
}

export function isValidDatabaseName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  const dbRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  return dbRegex.test(name);
}

export function isValidMappingName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  return nameRegex.test(name);
}

export function isNonEmptyString(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validatePortInput(input: string): string | true {
  const port = parseInt(input, 10);
  if (isNaN(port) || !isValidPort(port)) {
    return 'Please enter a valid port number (1-65535)';
  }
  return true;
}

export function validateHostInput(input: string): string | true {
  if (!isValidHost(input)) {
    return 'Please enter a valid hostname or IP address';
  }
  return true;
}

export function validateNonEmpty(input: string): string | true {
  if (!isNonEmptyString(input)) {
    return 'This field cannot be empty';
  }
  return true;
}

export function validateMappingName(input: string): string | true {
  if (!isValidMappingName(input)) {
    return 'Name must contain only letters, numbers, hyphens, and underscores';
  }
  return true;
}
