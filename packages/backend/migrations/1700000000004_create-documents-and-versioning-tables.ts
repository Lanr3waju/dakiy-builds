import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands: any = undefined;

/**
 * Migration: Create documents and versioning tables
 * 
 * This migration creates:
 * 1. documents table with metadata, tags, and cloud storage references
 * 2. document_versions table for version history
 * 3. document_links table for task/project associations
 * 4. Indexes for search and filtering
 * 
 * Requirements validated: 4.1, 4.2, 4.5, 4.6
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create documents table
  pgm.createTable('documents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    filename: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Original filename',
    },
    file_size_bytes: {
      type: 'bigint',
      notNull: true,
      comment: 'File size in bytes',
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'MIME type of the file',
    },
    storage_key: {
      type: 'varchar(500)',
      notNull: true,
      unique: true,
      comment: 'S3 storage key/path',
    },
    storage_bucket: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'S3 bucket name',
    },
    description: {
      type: 'text',
      notNull: false,
      comment: 'Optional document description',
    },
    tags: {
      type: 'text[]',
      notNull: false,
      default: '{}',
      comment: 'Array of tags for categorization',
    },
    current_version: {
      type: 'integer',
      notNull: true,
      default: 1,
      comment: 'Current version number',
    },
    uploaded_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who uploaded the document',
    },
    is_deleted: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Soft delete flag',
    },
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp when document was deleted',
    },
    deleted_by: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
      comment: 'User who deleted the document',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add constraint to ensure file_size_bytes is positive
  pgm.addConstraint('documents', 'check_file_size_positive', {
    check: 'file_size_bytes > 0',
  });

  // Add constraint to ensure current_version is positive
  pgm.addConstraint('documents', 'check_current_version_positive', {
    check: 'current_version > 0',
  });

  // Create trigger to auto-update updated_at for documents
  pgm.createTrigger('documents', 'update_documents_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Create indexes for documents table
  pgm.createIndex('documents', 'uploaded_by', {
    name: 'idx_documents_uploaded_by',
  });

  pgm.createIndex('documents', 'is_deleted', {
    name: 'idx_documents_is_deleted',
  });

  pgm.createIndex('documents', 'storage_key', {
    name: 'idx_documents_storage_key',
    unique: true,
  });

  // Create index for filename search (case-insensitive)
  pgm.createIndex('documents', 'filename', {
    name: 'idx_documents_filename',
    method: 'btree',
  });

  // Create GIN index for tags array for efficient tag searches
  pgm.createIndex('documents', 'tags', {
    name: 'idx_documents_tags',
    method: 'gin',
  });

  // Composite index for active documents by uploader
  pgm.createIndex('documents', ['uploaded_by', 'is_deleted'], {
    name: 'idx_documents_uploaded_by_deleted',
  });

  // Create document_versions table
  pgm.createTable('document_versions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    document_id: {
      type: 'uuid',
      notNull: true,
      references: 'documents',
      onDelete: 'CASCADE',
      comment: 'Parent document',
    },
    version_number: {
      type: 'integer',
      notNull: true,
      comment: 'Version number (1, 2, 3, ...)',
    },
    filename: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Filename for this version',
    },
    file_size_bytes: {
      type: 'bigint',
      notNull: true,
      comment: 'File size in bytes for this version',
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'MIME type for this version',
    },
    storage_key: {
      type: 'varchar(500)',
      notNull: true,
      unique: true,
      comment: 'S3 storage key/path for this version',
    },
    storage_bucket: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'S3 bucket name for this version',
    },
    change_notes: {
      type: 'text',
      notNull: false,
      comment: 'Optional notes about changes in this version',
    },
    uploaded_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who uploaded this version',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add constraint to ensure version_number is positive
  pgm.addConstraint('document_versions', 'check_version_number_positive', {
    check: 'version_number > 0',
  });

  // Add constraint to ensure file_size_bytes is positive
  pgm.addConstraint('document_versions', 'check_version_file_size_positive', {
    check: 'file_size_bytes > 0',
  });

  // Create unique constraint to prevent duplicate version numbers per document
  pgm.addConstraint('document_versions', 'unique_document_version', {
    unique: ['document_id', 'version_number'],
  });

  // Create indexes for document_versions table
  pgm.createIndex('document_versions', 'document_id', {
    name: 'idx_document_versions_document_id',
  });

  pgm.createIndex('document_versions', 'storage_key', {
    name: 'idx_document_versions_storage_key',
    unique: true,
  });

  // Composite index for version lookups
  pgm.createIndex('document_versions', ['document_id', 'version_number'], {
    name: 'idx_document_versions_document_version',
  });

  // Composite index for version history by uploader
  pgm.createIndex('document_versions', ['document_id', 'created_at'], {
    name: 'idx_document_versions_document_created',
  });

  // Create document_links table for task/project associations
  pgm.createTable('document_links', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    document_id: {
      type: 'uuid',
      notNull: true,
      references: 'documents',
      onDelete: 'CASCADE',
      comment: 'Document being linked',
    },
    project_id: {
      type: 'uuid',
      notNull: false,
      references: 'projects',
      onDelete: 'CASCADE',
      comment: 'Project this document is linked to (optional)',
    },
    task_id: {
      type: 'uuid',
      notNull: false,
      references: 'tasks',
      onDelete: 'CASCADE',
      comment: 'Task this document is linked to (optional)',
    },
    linked_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
      comment: 'User who created this link',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add constraint to ensure at least one of project_id or task_id is set
  pgm.addConstraint('document_links', 'check_link_target', {
    check: 'project_id IS NOT NULL OR task_id IS NOT NULL',
  });

  // Create unique constraint to prevent duplicate links
  pgm.addConstraint('document_links', 'unique_document_project_link', {
    unique: ['document_id', 'project_id'],
  });

  pgm.addConstraint('document_links', 'unique_document_task_link', {
    unique: ['document_id', 'task_id'],
  });

  // Create indexes for document_links table
  pgm.createIndex('document_links', 'document_id', {
    name: 'idx_document_links_document_id',
  });

  pgm.createIndex('document_links', 'project_id', {
    name: 'idx_document_links_project_id',
  });

  pgm.createIndex('document_links', 'task_id', {
    name: 'idx_document_links_task_id',
  });

  // Composite index for project document queries
  pgm.createIndex('document_links', ['project_id', 'document_id'], {
    name: 'idx_document_links_project_document',
  });

  // Composite index for task document queries
  pgm.createIndex('document_links', ['task_id', 'document_id'], {
    name: 'idx_document_links_task_document',
  });

  // Add comments to tables and columns
  pgm.sql(`
    COMMENT ON TABLE documents IS 'Documents stored in cloud storage with metadata and tags';
    COMMENT ON TABLE document_versions IS 'Version history for documents';
    COMMENT ON TABLE document_links IS 'Links between documents and projects/tasks';
    COMMENT ON COLUMN documents.filename IS 'Original filename';
    COMMENT ON COLUMN documents.file_size_bytes IS 'File size in bytes';
    COMMENT ON COLUMN documents.mime_type IS 'MIME type of the file';
    COMMENT ON COLUMN documents.storage_key IS 'S3 storage key/path';
    COMMENT ON COLUMN documents.storage_bucket IS 'S3 bucket name';
    COMMENT ON COLUMN documents.description IS 'Optional document description';
    COMMENT ON COLUMN documents.tags IS 'Array of tags for categorization';
    COMMENT ON COLUMN documents.current_version IS 'Current version number';
    COMMENT ON COLUMN documents.uploaded_by IS 'User who uploaded the document';
    COMMENT ON COLUMN documents.is_deleted IS 'Soft delete flag';
    COMMENT ON COLUMN documents.deleted_at IS 'Timestamp when document was deleted';
    COMMENT ON COLUMN documents.deleted_by IS 'User who deleted the document';
    COMMENT ON COLUMN document_versions.document_id IS 'Parent document';
    COMMENT ON COLUMN document_versions.version_number IS 'Version number (1, 2, 3, ...)';
    COMMENT ON COLUMN document_versions.filename IS 'Filename for this version';
    COMMENT ON COLUMN document_versions.file_size_bytes IS 'File size in bytes for this version';
    COMMENT ON COLUMN document_versions.mime_type IS 'MIME type for this version';
    COMMENT ON COLUMN document_versions.storage_key IS 'S3 storage key/path for this version';
    COMMENT ON COLUMN document_versions.storage_bucket IS 'S3 bucket name for this version';
    COMMENT ON COLUMN document_versions.change_notes IS 'Optional notes about changes in this version';
    COMMENT ON COLUMN document_versions.uploaded_by IS 'User who uploaded this version';
    COMMENT ON COLUMN document_links.document_id IS 'Document being linked';
    COMMENT ON COLUMN document_links.project_id IS 'Project this document is linked to (optional)';
    COMMENT ON COLUMN document_links.task_id IS 'Task this document is linked to (optional)';
    COMMENT ON COLUMN document_links.linked_by IS 'User who created this link';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop document_links table first (has foreign keys to documents)
  pgm.dropTable('document_links', { cascade: true });

  // Drop document_versions table (has foreign keys to documents)
  pgm.dropTable('document_versions', { cascade: true });

  // Drop documents table
  pgm.dropTable('documents', { cascade: true });
}
