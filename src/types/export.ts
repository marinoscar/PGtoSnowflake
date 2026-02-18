export type ExportFormat = 'parquet' | 'csv';

export interface ExportOptions {
  mappingFile: string;
  tables?: string[];
  format?: ExportFormat;
  outputDir?: string;
}

export interface ExportResult {
  schemaName: string;
  tableName: string;
  status: 'success' | 'error';
  rowCount: number;
  duration: number;
  filePath: string;
  fileSize: number;
  error?: string;
}

export interface ExportSummary {
  totalTables: number;
  successCount: number;
  errorCount: number;
  totalRows: number;
  totalDuration: number;
  results: ExportResult[];
}
