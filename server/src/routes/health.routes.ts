import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health
router.get('/', healthController.getHealth);

export default router;
