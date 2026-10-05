export type AdminRole = 'admin' | 'operations';

export interface AdminUserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSessionRecord {
  id: string;
  admin_user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface OrderEventRecord {
  id: string;
  order_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  admin_user_id: string | null;
  note: string | null;
  created_at: string;
  admin_name?: string | null;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  adminUserId: string | null;
  adminName: string | null;
  note: string | null;
  createdAt: string;
}

export interface UnifiedTimelineEvent {
  id: string;
  timestamp: string;
  type: 'order_event' | 'payment_attempt';
  title: string;
  description: string;
  actor: string;
  statusBadge?: string;
  metadata?: Record<string, any>;
}

export interface DashboardSummary {
  totalOrders: number;
  confirmedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalOrderValuePaise: number;
  totalOrderValue: number;
  paidOnlineValuePaise: number;
  paidOnlineValue: number;
  codOrderValuePaise: number;
  codOrderValue: number;
  failedPaymentAttempts: number;
  todayOrders: number;
  todayOrderValuePaise: number;
  todayOrderValue: number;
}

export interface OrderTrendPoint {
  date: string;
  ordersCount: number;
  valuePaise: number;
  value: number;
}

export interface PaymentMethodShare {
  method: string;
  count: number;
  totalPaise: number;
  total: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface DashboardMetrics {
  summary: DashboardSummary;
  orderTrend: OrderTrendPoint[];
  paymentMethodDistribution: PaymentMethodShare[];
  orderStatusDistribution: OrderStatusCount[];
  recentOrders: any[];
  recentPayments: any[];
}

export interface AdminOrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  sortBy?: 'created_at' | 'grand_total_paise' | 'order_number';
  sortDir?: 'asc' | 'desc';
  dateRange?: 'today' | '7d' | '30d' | 'all';
}

export interface AdminPaymentQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  method?: string;
  dateRange?: 'today' | '7d' | '30d' | 'all';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  discount: number;
  grandTotal: number;
  currency: string;
  destinationCity: string;
  destinationState: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderDetail {
  order: any;
  items: any[];
  payments: any[];
  timeline: UnifiedTimelineEvent[];
}

