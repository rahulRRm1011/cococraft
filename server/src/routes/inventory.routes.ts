import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller.js';

const router = Router();

router.get('/inventory/product/:reference', inventoryController.getProductAvailability);
router.get('/inventory/availability', inventoryController.getBatchAvailability);

export default router;
