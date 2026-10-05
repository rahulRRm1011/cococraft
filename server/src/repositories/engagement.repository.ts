import crypto from 'crypto';
import { BaseRepository } from './base.repository.js';
import {
  ReviewRecord,
  ReviewStatus,
  WishlistItemRecord,
  LoyaltyAccountRecord,
  LoyaltyTransactionRecord,
  CouponRecord,
  NotificationRecord,
  CustomerEventRecord,
} from '../types/engagement.js';

export class EngagementRepository extends BaseRepository {
  // ==========================================
  // 1. REVIEWS
  // ==========================================

  public async createReview(params: {
    id: string;
    customerId: string;
    productReference: string;
    orderId: string;
    rating: number;
    title: string;
    comment: string;
    customerName: string;
  }): Promise<ReviewRecord> {
    const { data, error } = await this.supabase
      .from('reviews')
      .insert({
        id: params.id,
        customer_id: params.customerId,
        product_reference: params.productReference.trim(),
        order_id: params.orderId,
        rating: params.rating,
        title: params.title.trim(),
        comment: params.comment.trim(),
        status: 'pending',
        customer_name: params.customerName.trim(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create review: ${error.message}`);
    }

    return data as ReviewRecord;
  }

  public async findReviewById(id: string): Promise<ReviewRecord | null> {
    const { data, error } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as ReviewRecord;
  }

  public async findReviewByCustomerOrderProduct(
    customerId: string,
    orderId: string,
    productRef: string
  ): Promise<ReviewRecord | null> {
    const { data, error } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('customer_id', customerId)
      .eq('order_id', orderId)
      .eq('product_reference', productRef)
      .maybeSingle();

    if (error || !data) return null;
    return data as ReviewRecord;
  }

  public async findApprovedReviewsByProduct(productRef: string): Promise<ReviewRecord[]> {
    const { data, error } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('product_reference', productRef)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as ReviewRecord[];
  }

  public async findProductRatingAggregate(productRef: string): Promise<{
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  }> {
    const reviews = await this.findApprovedReviewsByProduct(productRef);
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (reviews.length === 0) {
      return { averageRating: 0, totalReviews: 0, distribution: dist };
    }

    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      if (dist[r.rating] !== undefined) {
        dist[r.rating]++;
      }
    }

    const averageRating = Number((sum / reviews.length).toFixed(1));
    return {
      averageRating,
      totalReviews: reviews.length,
      distribution: dist,
    };
  }

  public async findReviewsByCustomer(customerId: string): Promise<ReviewRecord[]> {
    const { data, error } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as ReviewRecord[];
  }

  public async findReviewsForAdmin(query: { status?: string; limit?: number; page?: number } = {}): Promise<{
    items: ReviewRecord[];
    total: number;
  }> {
    const limit = query.limit || 50;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    let queryBuilder = this.supabase
      .from('reviews')
      .select('*', { count: 'exact' });

    if (query.status && query.status !== 'all') {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await queryBuilder;
    if (error || !data) {
      return { items: [], total: 0 };
    }

    return { items: data as ReviewRecord[], total: count || 0 };
  }

  public async updateReviewStatus(id: string, status: ReviewStatus): Promise<ReviewRecord | null> {
    const { data, error } = await this.supabase
      .from('reviews')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !data) return null;
    return data as ReviewRecord;
  }

  // ==========================================
  // 2. WISHLIST
  // ==========================================

  public async addWishlistItem(customerId: string, productReference: string): Promise<WishlistItemRecord> {
    const ref = productReference.trim();
    const existing = await this.supabase
      .from('wishlist_items')
      .select('*')
      .eq('customer_id', customerId)
      .eq('product_reference', ref)
      .maybeSingle();

    if (existing.data) {
      return existing.data as WishlistItemRecord;
    }

    const id = crypto.randomUUID();
    const { data, error } = await this.supabase
      .from('wishlist_items')
      .insert({
        id,
        customer_id: customerId,
        product_reference: ref,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add wishlist item: ${error.message}`);
    }

    return data as WishlistItemRecord;
  }

  public async removeWishlistItem(customerId: string, productReference: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('wishlist_items')
      .delete()
      .eq('customer_id', customerId)
      .eq('product_reference', productReference.trim());

    return !error;
  }

  public async findWishlistByCustomer(customerId: string): Promise<WishlistItemRecord[]> {
    const { data, error } = await this.supabase
      .from('wishlist_items')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as WishlistItemRecord[];
  }

  public async isProductInWishlist(customerId: string, productReference: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('wishlist_items')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('product_reference', productReference.trim());

    if (error) return false;
    return (count || 0) > 0;
  }

  public async countWishlistByCustomer(customerId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('wishlist_items')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (error) return 0;
    return count || 0;
  }

  // ==========================================
  // 3. LOYALTY & REWARDS
  // ==========================================

  public async getOrCreateLoyaltyAccount(customerId: string): Promise<LoyaltyAccountRecord> {
    const { data } = await this.supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (data) {
      return data as LoyaltyAccountRecord;
    }

    const { data: created, error } = await this.supabase
      .from('loyalty_accounts')
      .insert({
        customer_id: customerId,
        points_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      })
      .select()
      .single();

    if (error) {
      // In case of race condition, try reading once more
      const retry = await this.supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();
      if (retry.data) return retry.data as LoyaltyAccountRecord;
      throw new Error(`Failed to initialize loyalty account: ${error.message}`);
    }

    return created as LoyaltyAccountRecord;
  }

  public async hasOrderAwardedPoints(orderId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('loyalty_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('reference_type', 'order')
      .eq('reference_id', orderId);

    if (error) return false;
    return (count || 0) > 0;
  }

  public async awardPoints(
    customerId: string,
    points: number,
    referenceType: string,
    referenceId: string,
    description: string
  ): Promise<void> {
    if (points <= 0) return;

    const account = await this.getOrCreateLoyaltyAccount(customerId);

    await this.supabase
      .from('loyalty_accounts')
      .update({
        points_balance: account.points_balance + points,
        total_earned: account.total_earned + points,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId);

    await this.supabase
      .from('loyalty_transactions')
      .insert({
        id: crypto.randomUUID(),
        customer_id: customerId,
        transaction_type: 'earned',
        points,
        reference_type: referenceType,
        reference_id: referenceId,
        description,
      });
  }

  public async findLoyaltyTransactions(customerId: string): Promise<LoyaltyTransactionRecord[]> {
    const { data, error } = await this.supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as LoyaltyTransactionRecord[];
  }

  // ==========================================
  // 4. COUPONS
  // ==========================================

  public async findCouponByCode(code: string): Promise<CouponRecord | null> {
    const { data, error } = await this.supabase
      .from('coupons')
      .select('*')
      .ilike('code', code.trim())
      .maybeSingle();

    if (error || !data) return null;
    return data as CouponRecord;
  }

  public async findCouponById(id: string): Promise<CouponRecord | null> {
    const { data, error } = await this.supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as CouponRecord;
  }

  public async findAllCoupons(): Promise<CouponRecord[]> {
    const { data, error } = await this.supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as CouponRecord[];
  }

  public async createCoupon(params: {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minimumOrderAmount?: number;
    maximumDiscount?: number | null;
    startDate?: string | null;
    expiryDate?: string | null;
    usageLimit?: number | null;
  }): Promise<CouponRecord> {
    const { data, error } = await this.supabase
      .from('coupons')
      .insert({
        id: params.id,
        code: params.code.trim().toUpperCase(),
        discount_type: params.discountType,
        discount_value: params.discountValue,
        minimum_order_amount: params.minimumOrderAmount || 0,
        maximum_discount: params.maximumDiscount || null,
        start_date: params.startDate || null,
        expiry_date: params.expiryDate || null,
        usage_limit: params.usageLimit || null,
        used_count: 0,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create coupon: ${error.message}`);
    }

    return data as CouponRecord;
  }

  public async incrementCouponUsage(code: string): Promise<void> {
    const coupon = await this.findCouponByCode(code);
    if (!coupon) return;

    await this.supabase
      .from('coupons')
      .update({
        used_count: coupon.used_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coupon.id);
  }

  public async updateCouponStatus(id: string, status: 'active' | 'inactive' | 'expired'): Promise<CouponRecord | null> {
    const { data, error } = await this.supabase
      .from('coupons')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error || !data) return null;
    return data as CouponRecord;
  }

  // ==========================================
  // 5. NOTIFICATIONS
  // ==========================================

  public async createNotification(params: {
    id: string;
    customerId: string;
    title: string;
    message: string;
    type?: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }): Promise<NotificationRecord> {
    const { data, error } = await this.supabase
      .from('notifications')
      .insert({
        id: params.id,
        customer_id: params.customerId,
        title: params.title,
        message: params.message,
        type: params.type || 'general',
        is_read: false,
        reference_type: params.referenceType || null,
        reference_id: params.referenceId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data as NotificationRecord;
  }

  public async findNotificationsByCustomer(customerId: string): Promise<NotificationRecord[]> {
    const { data, error } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as NotificationRecord[];
  }

  public async markNotificationRead(id: string, customerId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('customer_id', customerId);

    return !error;
  }

  public async markAllNotificationsRead(customerId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('customer_id', customerId)
      .eq('is_read', false)
      .select('id');

    if (error || !data) return 0;
    return data.length;
  }

  public async countUnreadNotifications(customerId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('is_read', false);

    if (error) return 0;
    return count || 0;
  }

  // ==========================================
  // 6. CUSTOMER ACTIVITY EVENTS
  // ==========================================

  public async recordEvent(params: {
    customerId: string | null;
    eventType: string;
    referenceId?: string | null;
    metadata?: any;
  }): Promise<void> {
    await this.supabase.from('customer_events').insert({
      id: crypto.randomUUID(),
      customer_id: params.customerId || null,
      event_type: params.eventType,
      reference_id: params.referenceId || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  }

  public async findEventsByCustomer(customerId: string, limit = 20): Promise<CustomerEventRecord[]> {
    const { data, error } = await this.supabase
      .from('customer_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as CustomerEventRecord[];
  }
}

export const engagementRepository = new EngagementRepository();
