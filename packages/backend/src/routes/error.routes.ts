import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

interface ErrorLogRequest {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

router.post('/log', authenticate, async (req: Request, res: Response) => {
  try {
    const errorData: ErrorLogRequest = req.body;
    const userId = (req as any).user?.id;

    // Log the frontend error
    logger.error('Frontend error', {
      userId,
      message: errorData.message,
      stack: errorData.stack,
      componentStack: errorData.componentStack,
      timestamp: errorData.timestamp,
      userAgent: errorData.userAgent,
      url: errorData.url,
    });

    res.status(200).json({ message: 'Error logged successfully' });
  } catch (error) {
    logger.error('Failed to log frontend error', { error });
    res.status(500).json({ message: 'Failed to log error' });
  }
});

export default router;
