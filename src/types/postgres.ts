export interface PgConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface PgSchema {
  schemaName: string;
}

export interface PgTable {
  schemaName: string;
  tableName: string;
}

export interface PgColumn {
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

export interface PgPrimaryKey {
  schemaName: string;
  tableName: string;
  constraintName: string;
  columns: string[];
}

export interface PgForeignKey {
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

export interface PgIndex {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexDef: string;
  isUnique: boolean;
}

export interface PgSequence {
  schemaName: string;
  sequenceName: string;
  dataType: string;
  startValue: string;
  increment: string;
  ownerTable: string | null;
  ownerColumn: string | null;
}

export interface PgTableMetadata {
  schemaName: string;
  tableName: string;
  columns: PgColumn[];
  primaryKey: PgPrimaryKey | null;
  foreignKeys: PgForeignKey[];
  indexes: PgIndex[];
  sequences: PgSequence[];
}
