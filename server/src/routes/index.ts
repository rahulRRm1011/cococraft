import { Router } from 'express';
import healthRoutes from './health.routes.js';
import catalogRoutes from './catalog.routes.js';
import cartRoutes from './cart.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';
import inventoryRoutes from './inventory.routes.js';
import customerRoutes from './customer.routes.js';
import engagementRoutes from './engagement.routes.js';

const router = Router();

// Mount feature routes
router.use('/health', healthRoutes);
router.use('/', catalogRoutes);
router.use('/', cartRoutes);
router.use('/', orderRoutes);
router.use('/', paymentRoutes);
router.use('/', adminRoutes);
router.use('/', inventoryRoutes);
router.use('/', customerRoutes);
router.use('/', engagementRoutes);

export default router;
