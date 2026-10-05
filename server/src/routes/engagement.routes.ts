import { Router } from 'express';
import { engagementController } from '../controllers/engagement.controller.js';
import { requireCustomerAuth } from '../middleware/requireCustomerAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// ==========================================
// PUBLIC ENGAGEMENT ROUTES
// ==========================================
router.get('/products/:productRef/reviews', engagementController.getProductReviews);
router.get('/products/:slug/recommendations', engagementController.getRecommendations);
router.post('/coupons/validate', engagementController.validateCoupon);

// ==========================================
// CUSTOMER PRIVATE ENGAGEMENT ROUTES
// ==========================================
// Reviews
router.post('/customer/reviews', requireCustomerAuth, engagementController.createReview);
router.get('/customer/reviews', requireCustomerAuth, engagementController.getCustomerReviews);

// Wishlist
router.get('/customer/wishlist', requireCustomerAuth, engagementController.getCustomerWishlist);
router.post('/customer/wishlist', requireCustomerAuth, engagementController.addToWishlist);
router.delete('/customer/wishlist/:productRef', requireCustomerAuth, engagementController.removeFromWishlist);

// Loyalty
router.get('/customer/loyalty', requireCustomerAuth, engagementController.getCustomerLoyalty);

// Notifications
router.get('/customer/notifications', requireCustomerAuth, engagementController.getCustomerNotifications);
router.patch('/customer/notifications/read-all', requireCustomerAuth, engagementController.markAllNotificationsRead);
router.patch('/customer/notifications/:id/read', requireCustomerAuth, engagementController.markNotificationRead);

// Event tracking
router.post('/customer/events', engagementController.recordCustomerEvent);

// ==========================================
// ADMIN ENGAGEMENT OPERATIONS ROUTES
// ==========================================
// Reviews moderation
router.get('/admin/reviews', requireAdmin, engagementController.getAdminReviews);
router.patch('/admin/reviews/:id/status', requireAdmin, engagementController.updateReviewStatus);

// Coupons management
router.get('/admin/coupons', requireAdmin, engagementController.listCoupons);
router.post('/admin/coupons', requireAdmin, engagementController.createCoupon);
router.patch('/admin/coupons/:id/status', requireAdmin, engagementController.updateCouponStatus);

export default router;
