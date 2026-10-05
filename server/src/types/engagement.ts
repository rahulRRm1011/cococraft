export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export interface ReviewRecord {
  id: string;
  customer_id: string;
  product_reference: string;
  order_id: string;
  rating: number;
  title: string;
  comment: string;
  status: ReviewStatus;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewDTO {
  id: string;
  productReference: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  status: ReviewStatus;
  customerName: string;
  createdAt: string;
}

export interface ProductReviewSummaryDTO {
  averageRating: number;
  totalReviews: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  reviews: ReviewDTO[];
}

export interface CreateReviewInput {
  productReference: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
}

export interface WishlistItemRecord {
  id: string;
  customer_id: string;
  product_reference: string;
  created_at: string;
}

export interface WishlistItemDTO {
  id: string;
  productReference: string;
  createdAt: string;
  product?: {
    documentId?: string;
    slug: string;
    name: string;
    price: number;
    images: string[];
    stockStatus: string;
    category?: string;
  };
}

export interface LoyaltyAccountRecord {
  customer_id: string;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransactionRecord {
  id: string;
  customer_id: string;
  transaction_type: 'earned' | 'redeemed' | 'expired';
  points: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface LoyaltySummaryDTO {
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  transactions: {
    id: string;
    type: 'earned' | 'redeemed' | 'expired';
    points: number;
    description: string;
    createdAt: string;
  }[];
}

export interface CouponRecord {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount: number | null;
  start_date: string | null;
  expiry_date: string | null;
  usage_limit: number | null;
  used_count: number;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
}

export interface CouponDTO {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount?: number | null;
  expiryDate?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  status: string;
  createdAt: string;
}

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  coupon?: CouponDTO;
  discountPaise: number;
  discountRupees: number;
}

export interface NotificationRecord {
  id: string;
  customer_id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface CustomerEventRecord {
  id: string;
  customer_id: string | null;
  event_type: string;
  reference_id: string | null;
  metadata: string | null;
  created_at: string;
}
