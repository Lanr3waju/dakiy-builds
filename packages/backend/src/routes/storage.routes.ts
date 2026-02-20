import { Router, Response } from 'express';
import { storageService } from '../services/storage.service';
import {
  authenticate,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

// All storage routes require authentication
router.use(authenticate);

/**
 * GET /api/storage/:key
 * Download a file from storage
 */
router.get(
  '/*',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const key = req.params[0];

    if (!key) {
      throw new ValidationError('File key is required');
    }

    try {
      const fileBuffer = await storageService.getFileStream(key);
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
      
      res.send(fileBuffer);
    } catch (error) {
      logger.error('File download error', { key, error });
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
  })
);

export default router;
