import { Router, Response } from 'express';
import multer from 'multer';
import {
  uploadDocument,
  uploadDocumentVersion,
  getDocument,
  getDocumentDownloadUrl,
  deleteDocument,
  addDocumentTags,
  linkDocumentToProject,
  linkDocumentToTask,
  getDocumentVersions,
  searchDocuments,
  listDocuments,
  UploadDocumentDTO,
} from '../services/document.service';
import {
  authenticate,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// All document routes require authentication
router.use(authenticate);

/**
 * POST /api/documents
 * Upload a new document
 */
router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const { filename, description, tags } = req.body;

    const uploadDTO: UploadDocumentDTO = {
      filename: filename || req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      description,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim())) : undefined,
    };

    const document = await uploadDocument(uploadDTO, req.user!.id);

    logger.info('Document uploaded', { documentId: document.id, uploadedBy: req.user!.id });

    res.status(201).json({
      success: true,
      data: document,
    });
  })
);

/**
 * GET /api/documents/:id
 * Get document metadata
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    const document = await getDocument(id, req.user!.id);

    res.status(200).json({
      success: true,
      data: document,
    });
  })
);

/**
 * GET /api/documents/:id/download
 * Get document download URL
 */
router.get(
  '/:id/download',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    const downloadUrl = await getDocumentDownloadUrl(id, req.user!.id);

    res.status(200).json({
      success: true,
      data: {
        downloadUrl,
      },
    });
  })
);

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    await deleteDocument(id, req.user!.id);

    logger.info('Document deleted', { documentId: id, deletedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  })
);

/**
 * GET /api/documents
 * Search and list documents
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { query, project_id, task_id } = req.query;

    // If filtering by project or task, use listDocuments with filters
    if (project_id || task_id) {
      const filters: any = {};
      if (project_id && typeof project_id === 'string') {
        filters.projectId = project_id;
      }
      if (task_id && typeof task_id === 'string') {
        filters.taskId = task_id;
      }
      
      const documents = await listDocuments(req.user!.id, filters);
      
      res.status(200).json({
        success: true,
        data: documents,
        count: documents.length,
      });
      return;
    }

    // Otherwise use search
    const searchQuery = query && typeof query === 'string' ? query : '';
    const documents = await searchDocuments(searchQuery, req.user!.id);

    res.status(200).json({
      success: true,
      data: documents,
      count: documents.length,
    });
  })
);

export default router;

/**
 * POST /api/documents/:id/versions
 * Upload a new version of a document
 */
router.post(
  '/:id/versions',
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const { versionNotes } = req.body;

    const uploadDTO: UploadDocumentDTO = {
      filename: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    };

    const version = await uploadDocumentVersion(
      id,
      uploadDTO,
      versionNotes,
      req.user!.id
    );

    logger.info('Document version uploaded', { documentId: id, versionId: version.id, uploadedBy: req.user!.id });

    res.status(201).json({
      success: true,
      data: version,
    });
  })
);

/**
 * GET /api/documents/:id/versions
 * List all versions of a document
 */
router.get(
  '/:id/versions',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    const versions = await getDocumentVersions(id, req.user!.id);

    res.status(200).json({
      success: true,
      data: versions,
      count: versions.length,
    });
  })
);

/**
 * POST /api/documents/:id/tags
 * Add tags to a document
 */
router.post(
  '/:id/tags',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { tags } = req.body;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new ValidationError('Tags array is required');
    }

    await addDocumentTags(id, tags, req.user!.id);

    logger.info('Document tags added', { documentId: id, tags, addedBy: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Tags added successfully',
    });
  })
);

/**
 * POST /api/documents/:id/link
 * Link document to a task or project
 */
router.post(
  '/:id/link',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { projectId, taskId } = req.body;

    if (!id) {
      throw new ValidationError('Document ID is required');
    }

    if (!projectId && !taskId) {
      throw new ValidationError('Either projectId or taskId is required');
    }

    if (projectId && taskId) {
      throw new ValidationError('Cannot link to both project and task simultaneously');
    }

    if (projectId) {
      await linkDocumentToProject(id, projectId, req.user!.id);
      logger.info('Document linked to project', { documentId: id, projectId, linkedBy: req.user!.id });
    } else if (taskId) {
      await linkDocumentToTask(id, taskId, req.user!.id);
      logger.info('Document linked to task', { documentId: id, taskId, linkedBy: req.user!.id });
    }

    res.status(200).json({
      success: true,
      message: 'Document linked successfully',
    });
  })
);
