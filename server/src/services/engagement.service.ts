import crypto from 'crypto';
import { engagementRepository } from '../repositories/engagement.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { catalogService } from './catalog.service.js';
import { ProductSummary } from '../types/catalog.js';
import {
  ReviewRecord,
  ReviewDTO,
  ProductReviewSummaryDTO,
  CreateReviewInput,
  ReviewStatus,
  WishlistItemDTO,
  LoyaltySummaryDTO,
  CouponValidationResult,
  CouponDTO,
  NotificationDTO,
} from '../types/engagement.js';

export class EngagementService {
  // ==========================================
  // 1. REVIEWS & RATINGS
  // ==========================================

  private formatReviewDTO(record: ReviewRecord): ReviewDTO {
    return {
      id: record.id,
      productReference: record.product_reference,
      orderId: record.order_id,
      rating: record.rating,
      title: record.title,
      comment: record.comment,
      status: record.status,
      customerName: record.customer_name || 'Artisan Patron',
      createdAt: record.created_at,
    };
  }

  public async createReview(customerId: string, input: CreateReviewInput): Promise<ReviewDTO> {
    const customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      throw new Error('Customer account not found.');
    }

    if (!input.rating || input.rating < 1 || input.rating > 5) {
      throw new Error('Please select a star rating between 1 and 5.');
    }

    if (!input.title || input.title.trim().length < 3) {
      throw new Error('Review title must be at least 3 characters.');
    }

    if (!input.comment || input.comment.trim().length < 10) {
      throw new Error('Review feedback must be at least 10 characters.');
    }

    // 1. Verify customer owns order
    const order = await orderRepository.findCustomerOrderById(input.orderId, customerId);
    if (!order) {
      throw new Error('Only verified purchasers can review products from their orders.');
    }

    if (order.order_status !== 'delivered') {
      throw new Error('Only delivered purchases can be reviewed.');
    }

    // 2. Verify product exists in order
    const orderItems = await orderRepository.findOrderItems(order.id);
    const itemMatch = orderItems.find(
      (it) =>
        it.product_document_id === input.productReference ||
        it.product_slug === input.productReference
    );

    if (!itemMatch) {
      throw new Error('The specified piece was not found in this order.');
    }

    // 3. Verify single review per order item
    const existing = await engagementRepository.findReviewByCustomerOrderProduct(
      customerId,
      order.id,
      input.productReference
    );
    if (existing) {
      throw new Error('You have already submitted a review for this artisan creation.');
    }

    const reviewId = crypto.randomUUID();
    const record = await engagementRepository.createReview({
      id: reviewId,
      customerId,
      productReference: input.productReference,
      orderId: order.id,
      rating: Math.floor(input.rating),
      title: input.title,
      comment: input.comment,
      customerName: customer.name,
    });

    // Track activity event
    await engagementRepository.recordEvent({
      customerId,
      eventType: 'REVIEW_CREATED',
      referenceId: reviewId,
      metadata: { productReference: input.productReference, rating: input.rating },
    });

    // Notification for customer
    await engagementRepository.createNotification({
      id: crypto.randomUUID(),
      customerId,
      title: 'Review Received',
      message: `Thank you for reviewing "${itemMatch.product_name}". Your artisan feedback has been submitted for moderation.`,
      type: 'review',
      referenceType: 'review',
      referenceId: reviewId,
    });

    return this.formatReviewDTO(record);
  }

  public async getProductReviews(productRef: string): Promise<ProductReviewSummaryDTO> {
    const aggregate = await engagementRepository.findProductRatingAggregate(productRef);
    const reviews = await engagementRepository.findApprovedReviewsByProduct(productRef);

    return {
      averageRating: aggregate.averageRating,
      totalReviews: aggregate.totalReviews,
      distribution: aggregate.distribution as any,
      reviews: reviews.map((r) => this.formatReviewDTO(r)),
    };
  }

  public async getCustomerReviews(customerId: string): Promise<ReviewDTO[]> {
    const records = await engagementRepository.findReviewsByCustomer(customerId);
    return records.map((r) => this.formatReviewDTO(r));
  }

  public async getAdminReviews(query: { status?: string; limit?: number; page?: number } = {}) {
    const result = await engagementRepository.findReviewsForAdmin(query);
    return {
      items: result.items.map((r) => this.formatReviewDTO(r)),
      total: result.total,
    };
  }

  public async updateReviewStatus(id: string, status: ReviewStatus): Promise<ReviewDTO> {
    const updated = await engagementRepository.updateReviewStatus(id, status);
    if (!updated) {
      throw new Error('Review not found.');
    }

    if (status === 'approved') {
      await engagementRepository.createNotification({
        id: crypto.randomUUID(),
        customerId: updated.customer_id,
        title: 'Review Published',
        message: 'Your artisan product review has been approved and is now live on our storefront!',
        type: 'review',
        referenceType: 'review',
        referenceId: updated.id,
      });
    }

    return this.formatReviewDTO(updated);
  }

  // ==========================================
  // 2. WISHLIST
  // ==========================================

  public async addToWishlist(customerId: string, productReference: string): Promise<void> {
    await engagementRepository.addWishlistItem(customerId, productReference);
    await engagementRepository.recordEvent({
      customerId,
      eventType: 'WISHLIST_ADDED',
      referenceId: productReference,
    });
  }

  public async removeFromWishlist(customerId: string, productReference: string): Promise<void> {
    await engagementRepository.removeWishlistItem(customerId, productReference);
  }

  public async getCustomerWishlist(customerId: string): Promise<WishlistItemDTO[]> {
    const items = await engagementRepository.findWishlistByCustomer(customerId);
    const catalog: ProductSummary[] = await catalogService.getProducts();

    return items.map((item) => {
      const product = catalog.find(
        (p: ProductSummary) => p.documentId === item.product_reference || p.slug === item.product_reference
      );

      return {
        id: item.id,
        productReference: item.product_reference,
        createdAt: item.created_at,
        product: product
          ? {
              documentId: product.documentId,
              slug: product.slug,
              name: product.name,
              price: product.price,
              images: product.images,
              stockStatus: product.stockStatus,
              category: product.category?.name,
            }
          : undefined,
      };
    });
  }

  public async isProductInWishlist(customerId: string, productReference: string): Promise<boolean> {
    return engagementRepository.isProductInWishlist(customerId, productReference);
  }

  // ==========================================
  // 3. COUPONS & DISCOUNTS
  // ==========================================

  public async validateCoupon(code: string, subtotalPaise: number): Promise<CouponValidationResult> {
    if (!code || !code.trim()) {
      return { valid: false, message: 'Please enter a coupon code.', discountPaise: 0, discountRupees: 0 };
    }

    const coupon = await engagementRepository.findCouponByCode(code.trim());
    if (!coupon) {
      return { valid: false, message: 'Invalid coupon code.', discountPaise: 0, discountRupees: 0 };
    }

    if (coupon.status !== 'active') {
      return { valid: false, message: 'This coupon is no longer active.', discountPaise: 0, discountRupees: 0 };
    }

    if (coupon.expiry_date) {
      const expiry = new Date(coupon.expiry_date).getTime();
      if (Date.now() > expiry) {
        return { valid: false, message: 'This coupon code has expired.', discountPaise: 0, discountRupees: 0 };
      }
    }

    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return { valid: false, message: 'This coupon has reached its usage limit.', discountPaise: 0, discountRupees: 0 };
    }

    const minPaise = coupon.minimum_order_amount * 100;
    if (subtotalPaise < minPaise) {
      return {
        valid: false,
        message: `This coupon requires a minimum purchase of ₹${coupon.minimum_order_amount}.`,
        discountPaise: 0,
        discountRupees: 0,
      };
    }

    let calculatedDiscountPaise = 0;
    if (coupon.discount_type === 'percentage') {
      calculatedDiscountPaise = Math.round((subtotalPaise * coupon.discount_value) / 100);
      if (coupon.maximum_discount) {
        const maxPaise = coupon.maximum_discount * 100;
        if (calculatedDiscountPaise > maxPaise) {
          calculatedDiscountPaise = maxPaise;
        }
      }
    } else {
      calculatedDiscountPaise = coupon.discount_value * 100;
      if (calculatedDiscountPaise > subtotalPaise) {
        calculatedDiscountPaise = subtotalPaise;
      }
    }

    const couponDTO: CouponDTO = {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      minimumOrderAmount: coupon.minimum_order_amount,
      maximumDiscount: coupon.maximum_discount,
      expiryDate: coupon.expiry_date,
      usageLimit: coupon.usage_limit,
      usedCount: coupon.used_count,
      status: coupon.status,
      createdAt: coupon.created_at,
    };

    return {
      valid: true,
      coupon: couponDTO,
      discountPaise: calculatedDiscountPaise,
      discountRupees: Math.round(calculatedDiscountPaise / 100),
      message: `Coupon "${coupon.code}" successfully applied!`,
    };
  }

  public async recordCouponUsage(code: string): Promise<void> {
    await engagementRepository.incrementCouponUsage(code);
  }

  public async listCoupons(): Promise<CouponDTO[]> {
    const list = await engagementRepository.findAllCoupons();
    return list.map((c) => ({
      id: c.id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minimumOrderAmount: c.minimum_order_amount,
      maximumDiscount: c.maximum_discount,
      expiryDate: c.expiry_date,
      usageLimit: c.usage_limit,
      usedCount: c.used_count,
      status: c.status,
      createdAt: c.created_at,
    }));
  }

  public async createCoupon(input: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minimumOrderAmount?: number;
    maximumDiscount?: number | null;
    expiryDate?: string | null;
    usageLimit?: number | null;
  }): Promise<CouponDTO> {
    const code = input.code.trim().toUpperCase();
    const existing = await engagementRepository.findCouponByCode(code);
    if (existing) {
      throw new Error(`Coupon with code "${code}" already exists.`);
    }

    const created = await engagementRepository.createCoupon({
      id: crypto.randomUUID(),
      code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumOrderAmount: input.minimumOrderAmount || 0,
      maximumDiscount: input.maximumDiscount || null,
      expiryDate: input.expiryDate || null,
      usageLimit: input.usageLimit || null,
    });

    return {
      id: created.id,
      code: created.code,
      discountType: created.discount_type,
      discountValue: created.discount_value,
      minimumOrderAmount: created.minimum_order_amount,
      maximumDiscount: created.maximum_discount,
      expiryDate: created.expiry_date,
      usageLimit: created.usage_limit,
      usedCount: created.used_count,
      status: created.status,
      createdAt: created.created_at,
    };
  }

  public async updateCouponStatus(id: string, status: 'active' | 'inactive' | 'expired'): Promise<CouponDTO> {
    const updated = await engagementRepository.updateCouponStatus(id, status);
    if (!updated) throw new Error('Coupon not found.');
    return {
      id: updated.id,
      code: updated.code,
      discountType: updated.discount_type,
      discountValue: updated.discount_value,
      minimumOrderAmount: updated.minimum_order_amount,
      maximumDiscount: updated.maximum_discount,
      expiryDate: updated.expiry_date,
      usageLimit: updated.usage_limit,
      usedCount: updated.used_count,
      status: updated.status,
      createdAt: updated.created_at,
    };
  }

  // ==========================================
  // 4. LOYALTY POINTS REWARD
  // ==========================================

  /**
   * Awards loyalty points when an order transitions to 'delivered'
   * Rules: ₹100 spent = 10 points (1 point per ₹10).
   * Only awarded once per order. Skipped for guests.
   */
  public async awardLoyaltyPointsForOrder(orderId: string): Promise<void> {
    const order = await orderRepository.findOrderById(orderId);
    if (!order || !order.customer_id) return;

    if (order.order_status !== 'delivered') {
      return; // Only delivered orders earn loyalty points
    }

    if (await engagementRepository.hasOrderAwardedPoints(order.id)) {
      return; // Already awarded points for this order
    }

    // Points calculation: 1 point per 1000 paise (₹10)
    const points = Math.floor(order.grand_total_paise / 1000);
    if (points <= 0) return;

    await engagementRepository.awardPoints(
      order.customer_id,
      points,
      'order',
      order.id,
      `Reward points for delivered order ${order.order_number}`
    );

    await engagementRepository.createNotification({
      id: crypto.randomUUID(),
      customerId: order.customer_id,
      title: 'Artisan Loyalty Points Earned',
      message: `You earned ${points} loyalty points from delivered order ${order.order_number}!`,
      type: 'loyalty',
      referenceType: 'order',
      referenceId: order.id,
    });
  }

  public async getCustomerLoyalty(customerId: string): Promise<LoyaltySummaryDTO> {
    const account = await engagementRepository.getOrCreateLoyaltyAccount(customerId);
    const txs = await engagementRepository.findLoyaltyTransactions(customerId);

    return {
      pointsBalance: account.points_balance,
      totalEarned: account.total_earned,
      totalRedeemed: account.total_redeemed,
      transactions: txs.map((t) => ({
        id: t.id,
        type: t.transaction_type,
        points: t.points,
        description: t.description || 'Artisan reward activity',
        createdAt: t.created_at,
      })),
    };
  }

  // ==========================================
  // 5. NOTIFICATIONS
  // ==========================================

  public async getCustomerNotifications(customerId: string): Promise<{
    notifications: NotificationDTO[];
    unreadCount: number;
  }> {
    const records = await engagementRepository.findNotificationsByCustomer(customerId);
    const unread = await engagementRepository.countUnreadNotifications(customerId);

    return {
      notifications: records.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        type: r.type,
        isRead: Boolean(r.is_read),
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
      unreadCount: unread,
    };
  }

  public async markNotificationAsRead(id: string, customerId: string): Promise<void> {
    await engagementRepository.markNotificationRead(id, customerId);
  }

  public async markAllNotificationsAsRead(customerId: string): Promise<void> {
    await engagementRepository.markAllNotificationsRead(customerId);
  }

  // ==========================================
  // 6. ACTIVITY & PRODUCT RECOMMENDATIONS
  // ==========================================

  public async recordActivity(customerId: string | null, eventType: string, refId?: string, metadata?: any): Promise<void> {
    await engagementRepository.recordEvent({ customerId, eventType, referenceId: refId, metadata });
  }

  public async getRecommendations(productSlug: string): Promise<ProductSummary[]> {
    const allProducts: ProductSummary[] = await catalogService.getProducts();
    const current = allProducts.find((p: ProductSummary) => p.slug === productSlug);

    if (!current) {
      return allProducts.slice(0, 4);
    }

    // 1. Same category recommendations
    const sameCategory = allProducts.filter(
      (p: ProductSummary) => p.slug !== productSlug && p.category?.slug === current.category?.slug
    );

    if (sameCategory.length >= 4) {
      return sameCategory.slice(0, 4);
    }

    // 2. Fill remainder with other active products
    const otherProducts = allProducts.filter(
      (p: ProductSummary) => p.slug !== productSlug && !sameCategory.some((s: ProductSummary) => s.slug === p.slug)
    );

    return [...sameCategory, ...otherProducts].slice(0, 4);
  }
}

export const engagementService = new EngagementService();
