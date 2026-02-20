export type SourceEngine = 'postgresql' | 'mysql' | 'mssql';

export interface SourceConnectionConfig {
  engine: SourceEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  instanceName?: string;            // MSSQL named instances
  trustServerCertificate?: boolean;  // MSSQL
}

export interface SourceColumn {
  schemaName: string;
  tableName: string;
  columnName: string;
  ordinalPosition: number;
  columnDefault: string | null;
  isNullable: boolean;
  dataType: string;
  udtName: string;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  isIdentity: boolean;
  identityGeneration: string | null;
}

export interface SourcePrimaryKey {
  schemaName: string;
  tableName: string;
  constraintName: string;
  columns: string[];
}

export interface SourceForeignKey {
  schemaName: string;
  tableName: string;
  constraintName: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
  updateRule: string;
  deleteRule: string;
}

export interface SourceIndex {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexDef: string;
  isUnique: boolean;
}

export interface SourceSequence {
  schemaName: string;
  sequenceName: string;
  dataType: string;
  startValue: string;
  increment: string;
  ownerTable: string | null;
  ownerColumn: string | null;
}

export interface SourceTableMetadata {
  schemaName: string;
  tableName: string;
  columns: SourceColumn[];
  primaryKey: SourcePrimaryKey | null;
  foreignKeys: SourceForeignKey[];
  indexes: SourceIndex[];
  sequences: SourceSequence[];
}
