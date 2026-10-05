import { Router } from 'express';
import { adminAuthController } from '../controllers/adminAuth.controller.js';
import { adminDashboardController } from '../controllers/adminDashboard.controller.js';
import { adminOrderController } from '../controllers/adminOrder.controller.js';
import { adminPaymentController } from '../controllers/adminPayment.controller.js';
import { adminInventoryController } from '../controllers/adminInventory.controller.js';
import { adminAnalyticsController } from '../controllers/adminAnalytics.controller.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// --- Authentication ---
router.post('/admin/auth/login', adminAuthController.login);
router.post('/admin/auth/logout', requireAdmin, adminAuthController.logout);
router.get('/admin/auth/me', requireAdmin, adminAuthController.getMe);

// --- Operations Dashboard & Analytics ---
router.get('/admin/dashboard', requireAdmin, adminDashboardController.getDashboard);
router.get('/admin/analytics', requireAdmin, adminAnalyticsController.getAnalytics);

// --- Order Management ---
router.get('/admin/orders', requireAdmin, adminOrderController.getOrders);
router.get('/admin/orders/:orderId', requireAdmin, adminOrderController.getOrderDetail);
router.patch('/admin/orders/:orderId/status', requireAdmin, adminOrderController.updateStatus);

// --- Payment Monitoring ---
router.get('/admin/payments', requireAdmin, adminPaymentController.getPayments);
router.get('/admin/payments/:paymentId', requireAdmin, adminPaymentController.getPaymentDetail);

// --- Inventory Control & Stock Operations ---
router.get('/admin/inventory', requireAdmin, adminInventoryController.getInventory);
router.get('/admin/inventory/movements', requireAdmin, adminInventoryController.getMovements);
router.get('/admin/inventory/:productReference', requireAdmin, adminInventoryController.getInventoryDetail);
router.post('/admin/inventory/:productReference/adjust', requireAdmin, adminInventoryController.adjustStock);

export default router;
