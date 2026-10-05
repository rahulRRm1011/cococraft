import { Router } from 'express';
import { orderController } from '../controllers/order.controller.js';

const router = Router();

// Order configuration
router.get('/orders/config/shipping', orderController.getShippingConfig);

// Order creation and confirmation
router.post('/orders', orderController.createOrder);
router.get('/orders/:orderId/confirmation', orderController.getOrderConfirmation);

export default router;
