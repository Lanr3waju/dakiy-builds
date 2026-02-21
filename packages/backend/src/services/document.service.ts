import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { storageService } from './storage.service';
import { S3_BUCKET_NAME } from '../config/s3';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from '../utils/errors';
import { PoolClient } from 'pg';
import { randomBytes } from 'crypto';

// Types
export interface Document {
  id: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  storage_bucket: string;
  description: string | null;
  tags: string[];
  current_version: number;
  uploaded_by: string;
  is_deleted: boolean;
  deleted_at: Date | null;
  deleted_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  storage_bucket: string;
  change_notes: string | null;
  uploaded_by: string;
  created_at: Date;
}

export interface DocumentLink {
  id: string;
  document_id: string;
  project_id: string | null;
  task_id: string | null;
  linked_by: string;
  created_at: Date;
}

export interface UploadDocumentDTO {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  description?: string;
  tags?: string[];
}

export interface UpdateDocumentDTO {
  description?: string;
  tags?: string[];
}

export interface DocumentSearchFilters {
  filename?: string;
  tags?: string[];
  projectId?: string;
  taskId?: string;
}

// File size limit: 100MB
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/**
 * Generate a unique storage key for a file
 */
function generateStorageKey(filename: string): string {
  const timestamp = Date.now();
  const randomString = randomBytes(8).toString('hex');
  const extension = filename.split('.').pop();
  return `documents/${timestamp}-${randomString}.${extension}`;
}

/**
 * Verify user has access to a project
 */
async function verifyProjectAccess(
  projectId: string,
  userId: string,
  client: PoolClient
): Promise<boolean> {
  const result = await client.query(
    `SELECT p.id 
     FROM projects p
     LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
     LEFT JOIN users u ON u.id = $2
     WHERE p.id = $1 
     AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
    [projectId, userId]
  );

  return result.rows.length > 0;
}

/**
 * Verify user has access to a task
 */
async function verifyTaskAccess(
  taskId: string,
  userId: string,
  client: PoolClient
): Promise<boolean> {
  const result = await client.query(
    `SELECT t.id
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     LEFT JOIN project_team_members ptm ON p.id = ptm.project_id
     LEFT JOIN users u ON u.id = $2
     WHERE t.id = $1 
     AND (ptm.user_id = $2 OR u.role IN ('Admin', 'Project_Manager'))`,
    [taskId, userId]
  );

  return result.rows.length > 0;
}

/**
 * Upload a new document
 */
export async function uploadDocument(
  data: UploadDocumentDTO,
  userId: string
): Promise<Document> {
  // Validate input
  if (!data.filename || data.filename.trim().length === 0) {
    throw new ValidationError('Filename is required');
  }

  if (!data.buffer || data.buffer.length === 0) {
    throw new ValidationError('File content is required');
  }

  if (data.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
    );
  }

  if (!data.mimeType || data.mimeType.trim().length === 0) {
    throw new ValidationError('MIME type is required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate unique storage key
    const storageKey = generateStorageKey(data.filename);

    // Upload file to S3
    await storageService.uploadFile(
      storageKey,
      data.buffer,
      data.mimeType,
      {
        originalFilename: data.filename,
        uploadedBy: userId,
      }
    );

    // Create document record
    const docResult = await client.query(
      `INSERT INTO documents (
        filename, file_size_bytes, mime_type, storage_key, storage_bucket,
        description, tags, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.filename.trim(),
        data.buffer.length,
        data.mimeType.trim(),
        storageKey,
        S3_BUCKET_NAME,
        data.description?.trim() || null,
        data.tags || [],
        userId,
      ]
    );

    const document = docResult.rows[0];

    // Create initial version record
    await client.query(
      `INSERT INTO document_versions (
        document_id, version_number, filename, file_size_bytes, mime_type,
        storage_key, storage_bucket, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        document.id,
        1,
        data.filename.trim(),
        data.buffer.length,
        data.mimeType.trim(),
        storageKey,
        S3_BUCKET_NAME,
        userId,
      ]
    );

    await client.query('COMMIT');

    logger.info('Document uploaded', {
      documentId: document.id,
      filename: data.filename,
      userId,
    });

    return document;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error uploading document', { error, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Upload a new version of an existing document
 */
export async function uploadDocumentVersion(
  documentId: string,
  data: UploadDocumentDTO,
  changeNotes: string | undefined,
  userId: string
): Promise<DocumentVersion> {
  // Validate input
  if (!data.buffer || data.buffer.length === 0) {
    throw new ValidationError('File content is required');
  }

  if (data.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify document exists and user has access
    const docCheck = await client.query(
      `SELECT d.id, d.current_version, d.uploaded_by
       FROM documents d
       WHERE d.id = $1 AND d.is_deleted = false`,
      [documentId]
    );

    if (docCheck.rows.length === 0) {
      throw new NotFoundError('Document not found or has been deleted');
    }

    const document = docCheck.rows[0];
    const newVersionNumber = document.current_version + 1;

    // Generate unique storage key for new version
    const storageKey = generateStorageKey(data.filename);

    // Upload file to S3
    await storageService.uploadFile(
      storageKey,
      data.buffer,
      data.mimeType,
      {
        originalFilename: data.filename,
        uploadedBy: userId,
        version: newVersionNumber.toString(),
      }
    );

    // Create version record
    const versionResult = await client.query(
      `INSERT INTO document_versions (
        document_id, version_number, filename, file_size_bytes, mime_type,
        storage_key, storage_bucket, change_notes, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        documentId,
        newVersionNumber,
        data.filename.trim(),
        data.buffer.length,
        data.mimeType.trim(),
        storageKey,
        S3_BUCKET_NAME,
        changeNotes?.trim() || null,
        userId,
      ]
    );

    // Update document with new version info
    await client.query(
      `UPDATE documents 
       SET current_version = $1,
           filename = $2,
           file_size_bytes = $3,
           mime_type = $4,
           storage_key = $5
       WHERE id = $6`,
      [
        newVersionNumber,
        data.filename.trim(),
        data.buffer.length,
        data.mimeType.trim(),
        storageKey,
        documentId,
      ]
    );

    await client.query('COMMIT');

    logger.info('Document version uploaded', {
      documentId,
      version: newVersionNumber,
      userId,
    });

    return versionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error uploading document version', { error, documentId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get document metadata by ID
 */
export async function getDocument(
  documentId: string,
  _userId: string
): Promise<Document> {
  const result = await pool.query(
    `SELECT d.*
     FROM documents d
     WHERE d.id = $1 AND d.is_deleted = false`,
    [documentId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Document not found or has been deleted');
  }

  return result.rows[0];
}

/**
 * Get download URL for a document
 */
export async function getDocumentDownloadUrl(
  documentId: string,
  userId: string,
  versionNumber?: number
): Promise<string> {
  const client = await pool.connect();
  try {
    let storageKey: string;

    if (versionNumber) {
      // Get specific version
      const versionResult = await client.query(
        `SELECT dv.storage_key
         FROM document_versions dv
         JOIN documents d ON dv.document_id = d.id
         WHERE dv.document_id = $1 AND dv.version_number = $2 AND d.is_deleted = false`,
        [documentId, versionNumber]
      );

      if (versionResult.rows.length === 0) {
        throw new NotFoundError('Document version not found');
      }

      storageKey = versionResult.rows[0].storage_key;
    } else {
      // Get current version
      const docResult = await client.query(
        `SELECT d.storage_key
         FROM documents d
         WHERE d.id = $1 AND d.is_deleted = false`,
        [documentId]
      );

      if (docResult.rows.length === 0) {
        throw new NotFoundError('Document not found or has been deleted');
      }

      storageKey = docResult.rows[0].storage_key;
    }

    // Generate signed URL (valid for 1 hour)
    const url = await storageService.getFileUrl(storageKey, 3600);

    logger.info('Document download URL generated', { documentId, userId });

    return url;
  } finally {
    client.release();
  }
}

/**
 * List documents with optional filters
 */
export async function listDocuments(
  _userId: string,
  filters?: DocumentSearchFilters
): Promise<Document[]> {
  const conditions: string[] = ['d.is_deleted = false'];
  const values: any[] = [];
  let paramCount = 1;

  // Filter by filename (case-insensitive partial match)
  if (filters?.filename) {
    conditions.push(`d.filename ILIKE $${paramCount++}`);
    values.push(`%${filters.filename}%`);
  }

  // Filter by tags (documents that have any of the specified tags)
  if (filters?.tags && filters.tags.length > 0) {
    conditions.push(`d.tags && $${paramCount++}`);
    values.push(filters.tags);
  }

  // Filter by project
  if (filters?.projectId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM document_links dl 
      WHERE dl.document_id = d.id AND dl.project_id = $${paramCount++}
    )`);
    values.push(filters.projectId);
  }

  // Filter by task
  if (filters?.taskId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM document_links dl 
      WHERE dl.document_id = d.id AND dl.task_id = $${paramCount++}
    )`);
    values.push(filters.taskId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT d.*, d.created_at as uploaded_at
     FROM documents d
     ${whereClause}
     ORDER BY d.created_at DESC`,
    values
  );

  return result.rows;
}

/**
 * Update document metadata
 */
export async function updateDocument(
  documentId: string,
  data: UpdateDocumentDTO,
  userId: string
): Promise<Document> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify document exists
    const docCheck = await client.query(
      'SELECT id FROM documents WHERE id = $1 AND is_deleted = false',
      [documentId]
    );

    if (docCheck.rows.length === 0) {
      throw new NotFoundError('Document not found or has been deleted');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description?.trim() || null);
    }

    if (data.tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(data.tags);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(documentId);

    const result = await client.query(
      `UPDATE documents 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    await client.query('COMMIT');

    logger.info('Document updated', { documentId, userId });

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating document', { error, documentId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify document exists
    const docCheck = await client.query(
      'SELECT id, storage_key FROM documents WHERE id = $1 AND is_deleted = false',
      [documentId]
    );

    if (docCheck.rows.length === 0) {
      throw new NotFoundError('Document not found or has been deleted');
    }

    // Soft delete document
    await client.query(
      `UPDATE documents 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
       WHERE id = $2`,
      [userId, documentId]
    );

    await client.query('COMMIT');

    // Delete from S3 (async, don't wait)
    const storageKey = docCheck.rows[0].storage_key;
    storageService.deleteFile(storageKey).catch((error) => {
      logger.error('Error deleting file from S3', { error, storageKey });
    });

    // Delete all versions from S3 (async)
    const versionsResult = await pool.query(
      'SELECT storage_key FROM document_versions WHERE document_id = $1',
      [documentId]
    );

    for (const version of versionsResult.rows) {
      storageService.deleteFile(version.storage_key).catch((error) => {
        logger.error('Error deleting version from S3', {
          error,
          storageKey: version.storage_key,
        });
      });
    }

    logger.info('Document deleted', { documentId, userId });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting document', { error, documentId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Add tags to a document
 */
export async function addDocumentTags(
  documentId: string,
  tags: string[],
  userId: string
): Promise<Document> {
  if (!tags || tags.length === 0) {
    throw new ValidationError('At least one tag is required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current tags
    const docResult = await client.query(
      'SELECT tags FROM documents WHERE id = $1 AND is_deleted = false',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new NotFoundError('Document not found or has been deleted');
    }

    const currentTags = docResult.rows[0].tags || [];
    const newTags = [...new Set([...currentTags, ...tags])]; // Merge and deduplicate

    // Update document with new tags
    const result = await client.query(
      'UPDATE documents SET tags = $1 WHERE id = $2 RETURNING *',
      [newTags, documentId]
    );

    await client.query('COMMIT');

    logger.info('Document tags added', { documentId, tags, userId });

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error adding document tags', { error, documentId, userId });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Link a document to a project
 */
export async function linkDocumentToProject(
  documentId: string,
  projectId: string,
  userId: string
): Promise<DocumentLink> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify document exists
    const docCheck = await client.query(
      'SELECT id FROM documents WHERE id = $1 AND is_deleted = false',
      [documentId]
    );

    if (docCheck.rows.length === 0) {
      throw new NotFoundError('Document not found or has been deleted');
    }

    // Verify project exists and user has access
    const hasAccess = await verifyProjectAccess(projectId, userId, client);
    if (!hasAccess) {
      throw new AuthorizationError('Project not found or access denied');
    }

    // Check if link already exists
    const existingLink = await client.query(
      'SELECT id FROM document_links WHERE document_id = $1 AND project_id = $2',
      [documentId, projectId]
    );

    if (existingLink.rows.length > 0) {
      throw new ValidationError('Document is already linked to this project');
    }

    // Create link
    const result = await client.query(
      `INSERT INTO document_links (document_id, project_id, linked_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [documentId, projectId, userId]
    );

    await client.query('COMMIT');

    logger.info('Document linked to project', { documentId, projectId, userId });

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error linking document to project', {
      error,
      documentId,
      projectId,
      userId,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Link a document to a task
 */
export async function linkDocumentToTask(
  documentId: string,
  taskId: string,
  userId: string
): Promise<DocumentLink> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify document exists
    const docCheck = await client.query(
      'SELECT id FROM documents WHERE id = $1 AND is_deleted = false',
      [documentId]
    );

    if (docCheck.rows.length === 0) {
      throw new NotFoundError('Document not found or has been deleted');
    }

    // Verify task exists and user has access
    const hasAccess = await verifyTaskAccess(taskId, userId, client);
    if (!hasAccess) {
      throw new AuthorizationError('Task not found or access denied');
    }

    // Check if link already exists
    const existingLink = await client.query(
      'SELECT id FROM document_links WHERE document_id = $1 AND task_id = $2',
      [documentId, taskId]
    );

    if (existingLink.rows.length > 0) {
      throw new ValidationError('Document is already linked to this task');
    }

    // Create link
    const result = await client.query(
      `INSERT INTO document_links (document_id, task_id, linked_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [documentId, taskId, userId]
    );

    await client.query('COMMIT');

    logger.info('Document linked to task', { documentId, taskId, userId });

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error linking document to task', {
      error,
      documentId,
      taskId,
      userId,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all versions of a document
 */
export async function getDocumentVersions(
  documentId: string,
  _userId: string
): Promise<DocumentVersion[]> {
  // Verify document exists
  const docCheck = await pool.query(
    'SELECT id FROM documents WHERE id = $1 AND is_deleted = false',
    [documentId]
  );

  if (docCheck.rows.length === 0) {
    throw new NotFoundError('Document not found or has been deleted');
  }

  const result = await pool.query(
    `SELECT *, created_at as uploaded_at FROM document_versions 
     WHERE document_id = $1 
     ORDER BY version_number DESC`,
    [documentId]
  );

  return result.rows;
}

/**
 * Search documents by tags and filename
 */
export async function searchDocuments(
  query: string,
  _userId: string
): Promise<Document[]> {
  const result = await pool.query(
    `SELECT d.*, d.created_at as uploaded_at
     FROM documents d
     WHERE d.is_deleted = false
     AND (
       d.filename ILIKE $1
       OR d.description ILIKE $1
       OR EXISTS (
         SELECT 1 FROM unnest(d.tags) AS tag
         WHERE tag ILIKE $1
       )
     )
     ORDER BY d.created_at DESC`,
    [`%${query}%`]
  );

  return result.rows;
}
