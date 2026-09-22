import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

// Mount feature routes
router.use('/health', healthRoutes);

export default router;
