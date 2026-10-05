export interface SalesOverviewMetrics {
  totalRevenuePaise: number;
  totalRevenueRupees: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  totalOrdersCount: number;
  averageOrderValueRupees: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomersPeriod: number;
  returningCustomers: number;
  repeatPurchaseRate: number;
}

export interface SalesTrendPoint {
  periodLabel: string;
  revenueRupees: number;
  ordersCount: number;
}

export interface ProductPerformanceMetric {
  productSlug: string;
  productName: string;
  views: number;
  wishlistAdds: number;
  cartAdds: number;
  purchases: number;
  revenueRupees: number;
  conversionRate: number;
}

export interface FunnelStep {
  step: string;
  label: string;
  count: number;
  conversionRate: number;
}

export interface CategoryPerformanceMetric {
  categoryName: string;
  categorySlug: string;
  revenueRupees: number;
  ordersCount: number;
  views: number;
}

export interface ComprehensiveAnalyticsResult {
  period: 'today' | '7d' | '30d' | 'all';
  overview: SalesOverviewMetrics;
  customerMetrics: CustomerMetrics;
  salesTrend: SalesTrendPoint[];
  productPerformance: ProductPerformanceMetric[];
  funnel: FunnelStep[];
  categoryPerformance: CategoryPerformanceMetric[];
}
