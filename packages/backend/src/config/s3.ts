import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

const s3Config: S3ClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true;
}

export const s3Client = new S3Client(s3Config);

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'dakiybuilds-documents';

logger.info('S3 client initialized', {
  region: s3Config.region,
  bucket: S3_BUCKET_NAME,
});
