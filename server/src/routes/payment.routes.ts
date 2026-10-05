import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';

const router = Router();

// Payment lifecycle endpoints
router.post('/payments', paymentController.initiatePayment);
router.get('/payments/:paymentId', paymentController.getPayment);
router.post('/payments/:paymentId/process', paymentController.processPayment);
router.post('/payments/:paymentId/verify', paymentController.verifyPendingPayment);

// Order payment history
router.get('/orders/:orderId/payments', paymentController.getOrderPayments);

export default router;
