export class PgToSnowflakeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PgToSnowflakeError';
  }
}

export class ConfigNotFoundError extends PgToSnowflakeError {
  constructor(message = 'Configuration not found. Run "init" first.') {
    super(message, 'CONFIG_NOT_FOUND');
    this.name = 'ConfigNotFoundError';
  }
}

export class EncryptionError extends PgToSnowflakeError {
  constructor(message: string, cause?: Error) {
    super(message, 'ENCRYPTION_ERROR', cause);
    this.name = 'EncryptionError';
  }
}

export class ConnectionError extends PgToSnowflakeError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONNECTION_ERROR', cause);
    this.name = 'ConnectionError';
  }
}

export class MappingError extends PgToSnowflakeError {
  constructor(message: string, cause?: Error) {
    super(message, 'MAPPING_ERROR', cause);
    this.name = 'MappingError';
  }
}

export class ExportError extends PgToSnowflakeError {
  constructor(message: string, cause?: Error) {
    super(message, 'EXPORT_ERROR', cause);
    this.name = 'ExportError';
  }
}

export class DDLGenerationError extends PgToSnowflakeError {
  constructor(message: string, cause?: Error) {
    super(message, 'DDL_GENERATION_ERROR', cause);
    this.name = 'DDLGenerationError';
  }
}

export class S3UploadError extends PgToSnowflakeError {
  constructor(message: string, cause?: Error) {
    super(message, 'S3_UPLOAD_ERROR', cause);
    this.name = 'S3UploadError';
  }
}
