import { Router } from 'express';
import { cartController } from '../controllers/cart.controller.js';

const router = Router();

// Cart lifecycle endpoints
router.post('/cart', cartController.getOrCreateCart);
router.get('/cart/:cartId', cartController.getCart);
router.delete('/cart/:cartId', cartController.clearCart);

// Cart item endpoints
router.post('/cart/:cartId/items', cartController.addItem);
router.patch('/cart/:cartId/items/:itemId', cartController.updateItem);
router.delete('/cart/:cartId/items/:itemId', cartController.removeItem);

export default router;
