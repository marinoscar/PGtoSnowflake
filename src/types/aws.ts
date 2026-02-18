import type { EncryptedPayload } from './config.js';

export interface SavedAwsCredentials {
  accessKeyId: string;
  secretAccessKey: EncryptedPayload;
  region: string;
  createdAt: string;
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface S3UploadResult {
  localPath: string;
  s3Key: string;
  status: 'success' | 'error';
  fileSize: number;
  duration: number;
  error?: string;
}

export interface S3UploadSummary {
  bucket: string;
  prefix: string;
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalBytes: number;
  totalDuration: number;
  results: S3UploadResult[];
}
