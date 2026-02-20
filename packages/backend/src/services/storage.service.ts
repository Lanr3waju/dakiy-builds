import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_NAME } from '../config/s3';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';
import * as fs from 'fs';
import * as path from 'path';

const USE_LOCAL_STORAGE = !process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'test';
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'uploads');

// Create uploads directory if using local storage
if (USE_LOCAL_STORAGE) {
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
  }
  logger.info('Using local file storage for documents', { path: LOCAL_STORAGE_PATH });
}

export class StorageService {
  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    if (USE_LOCAL_STORAGE) {
      try {
        const filePath = path.join(LOCAL_STORAGE_PATH, key);
        const dir = path.dirname(filePath);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, buffer);
        logger.info('File uploaded to local storage', { key });
        return key;
      } catch (error) {
        logger.error('Local storage upload error', { key, error });
        throw new ExternalServiceError('LocalStorage', 'Failed to upload file');
      }
    }

    try {
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await s3Client.send(command);
      logger.info('File uploaded to S3', { key });
      return key;
    } catch (error) {
      logger.error('S3 upload error', { key, error });
      throw new ExternalServiceError('S3', 'Failed to upload file');
    }
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (USE_LOCAL_STORAGE) {
      // For local storage, return a URL that the backend will serve
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      return `${baseUrl}/api/storage/${key}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error('S3 get URL error', { key, error });
      throw new ExternalServiceError('S3', 'Failed to generate file URL');
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (USE_LOCAL_STORAGE) {
      try {
        const filePath = path.join(LOCAL_STORAGE_PATH, key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info('File deleted from local storage', { key });
        }
        return;
      } catch (error) {
        logger.error('Local storage delete error', { key, error });
        throw new ExternalServiceError('LocalStorage', 'Failed to delete file');
      }
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      logger.info('File deleted from S3', { key });
    } catch (error) {
      logger.error('S3 delete error', { key, error });
      throw new ExternalServiceError('S3', 'Failed to delete file');
    }
  }

  async fileExists(key: string): Promise<boolean> {
    if (USE_LOCAL_STORAGE) {
      const filePath = path.join(LOCAL_STORAGE_PATH, key);
      return fs.existsSync(filePath);
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFileStream(key: string): Promise<Buffer> {
    if (USE_LOCAL_STORAGE) {
      try {
        const filePath = path.join(LOCAL_STORAGE_PATH, key);
        return fs.readFileSync(filePath);
      } catch (error) {
        logger.error('Local storage read error', { key, error });
        throw new ExternalServiceError('LocalStorage', 'Failed to read file');
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      const stream = response.Body as any;
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('S3 read error', { key, error });
      throw new ExternalServiceError('S3', 'Failed to read file');
    }
  }
}

export const storageService = new StorageService();
