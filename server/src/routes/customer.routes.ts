import { Router } from 'express';
import { customerAuthController } from '../controllers/customerAuth.controller.js';
import { customerAccountController } from '../controllers/customerAccount.controller.js';
import { requireCustomerAuth } from '../middleware/requireCustomerAuth.js';

const router = Router();

// ==========================================
// CUSTOMER AUTHENTICATION (PUBLIC)
// ==========================================
router.post('/customer/auth/register', customerAuthController.register);
router.post('/customer/auth/login', customerAuthController.login);
router.post('/customer/auth/logout', customerAuthController.logout);

// ==========================================
// CUSTOMER SESSION CHECK (PROTECTED)
// ==========================================
router.get('/customer/auth/me', requireCustomerAuth, customerAuthController.getMe);

// ==========================================
// CUSTOMER PROFILE (PROTECTED)
// ==========================================
router.get('/customer/profile', requireCustomerAuth, customerAccountController.getProfile);
router.patch('/customer/profile', requireCustomerAuth, customerAccountController.updateProfile);
router.post('/customer/profile/password', requireCustomerAuth, customerAccountController.changePassword);

// ==========================================
// CUSTOMER ADDRESS BOOK (PROTECTED)
// ==========================================
router.get('/customer/addresses', requireCustomerAuth, customerAccountController.getAddresses);
router.post('/customer/addresses', requireCustomerAuth, customerAccountController.createAddress);
router.patch('/customer/addresses/:id', requireCustomerAuth, customerAccountController.updateAddress);
router.delete('/customer/addresses/:id', requireCustomerAuth, customerAccountController.deleteAddress);

// ==========================================
// CUSTOMER ORDERS (PROTECTED)
// ==========================================
router.get('/customer/orders', requireCustomerAuth, customerAccountController.getOrders);
router.get('/customer/orders/:orderId', requireCustomerAuth, customerAccountController.getOrderDetail);

export default router;
