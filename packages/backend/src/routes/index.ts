import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import documentRoutes from './document.routes';
import analyticsRoutes from './analytics.routes';
import adminRoutes from './admin.routes';
import errorRoutes from './error.routes';
import storageRoutes from './storage.routes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/', taskRoutes);
router.use('/documents', documentRoutes);
router.use('/', analyticsRoutes);
router.use('/admin', adminRoutes);
router.use('/errors', errorRoutes);
router.use('/storage', storageRoutes);

export default router;
