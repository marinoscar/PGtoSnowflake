export interface SnowflakeColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isIdentity: boolean;
  identitySeed: number;
  identityIncrement: number;
  comment: string | null;
}

export interface SnowflakeTable {
  schemaName: string;
  tableName: string;
  columns: SnowflakeColumn[];
  primaryKeyColumns: string[];
}

export interface SnowflakeForeignKey {
  constraintName: string;
  schemaName: string;
  tableName: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
}

export interface SnowflakeDDL {
  schemas: string[];
  tables: SnowflakeTable[];
  foreignKeys: SnowflakeForeignKey[];
}
