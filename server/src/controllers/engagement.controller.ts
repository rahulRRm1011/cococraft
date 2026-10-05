import { Request, Response, NextFunction } from 'express';
import { engagementService } from '../services/engagement.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { AuthenticatedCustomerRequest } from '../middleware/requireCustomerAuth.js';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { ReviewStatus } from '../types/engagement.js';

export class EngagementController {
  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  public getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const productRef = req.params.productRef || req.params.id;
      if (!productRef) {
        sendError(res, 'Product reference is required', 400);
        return;
      }
      const data = await engagementService.getProductReviews(String(productRef));
      sendSuccess(res, data, 'Product reviews retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params.slug;
      if (!slug) {
        sendError(res, 'Product slug is required', 400);
        return;
      }
      const recommendations = await engagementService.getRecommendations(String(slug));
      sendSuccess(res, recommendations, 'Recommended pieces retrieved');
    } catch (error) {
      next(error);
    }
  };

  public validateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, cartSubtotalPaise } = req.body;
      if (!code) {
        sendError(res, 'Please provide a coupon code', 400);
        return;
      }
      const subtotal = Number(cartSubtotalPaise) || 0;
      const result = await engagementService.validateCoupon(code, subtotal);
      if (!result.valid) {
        sendError(res, result.message || 'Invalid coupon code', 400);
        return;
      }
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // CUSTOMER PRIVATE ENDPOINTS
  // ==========================================

  public createReview = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const { productReference, orderId, rating, title, comment } = req.body;
      const review = await engagementService.createReview(req.customer.id, {
        productReference,
        orderId,
        rating: Number(rating),
        title,
        comment,
      });
      sendSuccess(res, review, 'Your artisan review has been submitted for moderation', 201);
    } catch (error: any) {
      if (
        error.message?.includes('Only verified') ||
        error.message?.includes('already submitted') ||
        error.message?.includes('between 1 and 5') ||
        error.message?.includes('Review title') ||
        error.message?.includes('Review feedback') ||
        error.message?.includes('not found')
      ) {
        sendError(res, error.message, 400);
        return;
      }
      next(error);
    }
  };

  public getCustomerReviews = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const reviews = await engagementService.getCustomerReviews(req.customer.id);
      sendSuccess(res, reviews, 'Customer reviews retrieved');
    } catch (error) {
      next(error);
    }
  };

  public getCustomerWishlist = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const wishlist = await engagementService.getCustomerWishlist(req.customer.id);
      sendSuccess(res, wishlist, 'Wishlist retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public addToWishlist = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const { productReference } = req.body;
      if (!productReference) {
        sendError(res, 'Product reference is required', 400);
        return;
      }
      await engagementService.addToWishlist(req.customer.id, productReference);
      sendSuccess(res, { productReference, saved: true }, 'Item saved to your wishlist');
    } catch (error) {
      next(error);
    }
  };

  public removeFromWishlist = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const productRef = req.params.productRef;
      if (!productRef) {
        sendError(res, 'Product reference is required', 400);
        return;
      }
      await engagementService.removeFromWishlist(req.customer.id, String(productRef));
      sendSuccess(res, { productReference: productRef, removed: true }, 'Item removed from your wishlist');
    } catch (error) {
      next(error);
    }
  };

  public getCustomerLoyalty = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const loyalty = await engagementService.getCustomerLoyalty(req.customer.id);
      sendSuccess(res, loyalty, 'Artisan rewards summary retrieved');
    } catch (error) {
      next(error);
    }
  };

  public getCustomerNotifications = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const data = await engagementService.getCustomerNotifications(req.customer.id);
      sendSuccess(res, data, 'Notifications retrieved');
    } catch (error) {
      next(error);
    }
  };

  public markNotificationRead = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const id = req.params.id;
      await engagementService.markNotificationAsRead(String(id), req.customer.id);
      sendSuccess(res, { success: true }, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  };

  public markAllNotificationsRead = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      await engagementService.markAllNotificationsAsRead(req.customer.id);
      sendSuccess(res, { success: true }, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  };

  public recordCustomerEvent = async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = req.customer?.id || null;
      const { eventType, referenceId, metadata } = req.body;
      if (!eventType) {
        sendError(res, 'Event type is required', 400);
        return;
      }
      await engagementService.recordActivity(customerId, eventType, referenceId, metadata);
      sendSuccess(res, { recorded: true }, 'Event recorded');
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // ADMIN OPERATIONS ENDPOINTS
  // ==========================================

  public getAdminReviews = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, limit, page } = req.query;
      const reviews = await engagementService.getAdminReviews({
        status: status as string | undefined,
        limit: limit ? Number(limit) : undefined,
        page: page ? Number(page) : undefined,
      });
      sendSuccess(res, reviews, 'Admin reviews retrieved');
    } catch (error) {
      next(error);
    }
  };

  public updateReviewStatus = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      if (!['pending', 'approved', 'rejected', 'hidden'].includes(status)) {
        sendError(res, 'Invalid review status. Must be pending, approved, rejected, or hidden.', 400);
        return;
      }
      const updated = await engagementService.updateReviewStatus(id, status as ReviewStatus);
      sendSuccess(res, updated, `Review status updated to ${status}`);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  public listCoupons = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await engagementService.listCoupons();
      sendSuccess(res, coupons, 'Coupons retrieved');
    } catch (error) {
      next(error);
    }
  };

  public createCoupon = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, discountType, discountValue, minimumOrderAmount, maximumDiscount, expiryDate, usageLimit } = req.body;
      if (!code || !discountType || discountValue === undefined) {
        sendError(res, 'Code, discountType and discountValue are required', 400);
        return;
      }
      const coupon = await engagementService.createCoupon({
        code,
        discountType,
        discountValue: Number(discountValue),
        minimumOrderAmount: minimumOrderAmount ? Number(minimumOrderAmount) : 0,
        maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
        expiryDate: expiryDate || null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
      });
      sendSuccess(res, coupon, 'Coupon created successfully', 201);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        sendError(res, error.message, 400);
        return;
      }
      next(error);
    }
  };

  public updateCouponStatus = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const { status } = req.body;
      if (!['active', 'inactive', 'expired'].includes(status)) {
        sendError(res, 'Invalid coupon status', 400);
        return;
      }
      const updated = await engagementService.updateCouponStatus(id, status);
      sendSuccess(res, updated, `Coupon status updated to ${status}`);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };
}

export const engagementController = new EngagementController();
