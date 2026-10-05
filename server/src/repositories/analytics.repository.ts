import { BaseRepository } from './base.repository.js';
import {
  SalesOverviewMetrics,
  CustomerMetrics,
  SalesTrendPoint,
  ProductPerformanceMetric,
  FunnelStep,
} from '../types/analytics.js';

export class AnalyticsRepository extends BaseRepository {
  private getStartDate(period: string): string | null {
    const now = new Date();
    switch (period) {
      case 'today': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start.toISOString();
      }
      case '7d': {
        const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        return start.toISOString();
      }
      case '30d': {
        const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        return start.toISOString();
      }
      case 'all':
      default:
        return null;
    }
  }

  /**
   * Aggregates overview numbers: total revenue, completed, pending, cancelled, AOV
   */
  public async getSalesOverview(period: string): Promise<SalesOverviewMetrics> {
    const startDate = this.getStartDate(period);

    let query = this.supabase
      .from('orders')
      .select('payment_status, order_status, grand_total_paise');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    const { data: rows, error } = await query;
    if (error || !rows) {
      return {
        totalRevenuePaise: 0,
        totalRevenueRupees: 0,
        completedOrdersCount: 0,
        pendingOrdersCount: 0,
        cancelledOrdersCount: 0,
        totalOrdersCount: 0,
        averageOrderValueRupees: 0,
      };
    }

    let totalRevenuePaise = 0;
    let completedOrdersCount = 0;
    let pendingOrdersCount = 0;
    let cancelledOrdersCount = 0;
    const totalOrdersCount = rows.length;

    for (const order of rows) {
      const isPaid = order.payment_status === 'paid' ||
        ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.order_status);

      if (isPaid) {
        totalRevenuePaise += Number(order.grand_total_paise) || 0;
      }

      if (order.order_status === 'delivered') {
        completedOrdersCount++;
      } else if (['placed', 'confirmed', 'processing', 'shipped'].includes(order.order_status)) {
        pendingOrdersCount++;
      } else if (order.order_status === 'cancelled') {
        cancelledOrdersCount++;
      }
    }

    const totalRevenueRupees = Math.round(totalRevenuePaise / 100);
    const paidOrders = completedOrdersCount + pendingOrdersCount || 1;
    const averageOrderValueRupees = Math.round(totalRevenueRupees / Math.max(1, paidOrders));

    return {
      totalRevenuePaise,
      totalRevenueRupees,
      completedOrdersCount,
      pendingOrdersCount,
      cancelledOrdersCount,
      totalOrdersCount,
      averageOrderValueRupees,
    };
  }

  /**
   * Aggregates sales timeline over days or hours
   */
  public async getSalesTrend(period: string): Promise<SalesTrendPoint[]> {
    const startDate = this.getStartDate(period);
    const isToday = period === 'today';

    let query = this.supabase
      .from('orders')
      .select('created_at, payment_status, order_status, grand_total_paise')
      .order('created_at', { ascending: true });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const bucketMap = new Map<string, { revenuePaise: number; ordersCount: number }>();

    for (const r of rows) {
      const d = new Date(r.created_at);
      let label: string;
      if (isToday) {
        const hour = String(d.getHours()).padStart(2, '0');
        label = `${hour}:00`;
      } else {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        label = `${y}-${m}-${day}`;
      }

      const existing = bucketMap.get(label) || { revenuePaise: 0, ordersCount: 0 };
      existing.ordersCount++;

      const isPaid = r.payment_status === 'paid' ||
        ['confirmed', 'processing', 'shipped', 'delivered'].includes(r.order_status);

      if (isPaid) {
        existing.revenuePaise += Number(r.grand_total_paise) || 0;
      }

      bucketMap.set(label, existing);
    }

    return Array.from(bucketMap.entries()).map(([periodLabel, val]) => ({
      periodLabel,
      revenueRupees: Math.round(val.revenuePaise / 100),
      ordersCount: val.ordersCount,
    }));
  }

  /**
   * Aggregates total customers, new acquisitions, and repeat buyers
   */
  public async getCustomerMetrics(period: string): Promise<CustomerMetrics> {
    const { count: totalCustomers } = await this.supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const startDate = this.getStartDate(period);
    let newQuery = this.supabase.from('customers').select('*', { count: 'exact', head: true });
    if (startDate) {
      newQuery = newQuery.gte('created_at', startDate);
    }
    const { count: newCustomersPeriod } = await newQuery;

    // Returning customers: customers who have placed at least 2 orders
    const { data: orders } = await this.supabase
      .from('orders')
      .select('customer_id')
      .not('customer_id', 'is', null);

    const countsByCustomer: Record<string, number> = {};
    if (orders) {
      for (const o of orders) {
        if (o.customer_id) {
          countsByCustomer[o.customer_id] = (countsByCustomer[o.customer_id] || 0) + 1;
        }
      }
    }

    const returningCustomers = Object.values(countsByCustomer).filter((c) => c >= 2).length;
    const total = totalCustomers || 0;
    const repeatPurchaseRate = total > 0 ? Math.round((returningCustomers / total) * 100) : 0;

    return {
      totalCustomers: total,
      newCustomersPeriod: newCustomersPeriod || 0,
      returningCustomers,
      repeatPurchaseRate,
    };
  }

  /**
   * Aggregates product interactions: Views, Wishlist adds, Cart adds, and Purchases
   */
  public async getProductPerformance(period: string): Promise<ProductPerformanceMetric[]> {
    const startDate = this.getStartDate(period);

    let eventQuery = this.supabase
      .from('customer_events')
      .select('event_type, reference_id')
      .not('reference_id', 'is', null);

    if (startDate) {
      eventQuery = eventQuery.gte('created_at', startDate);
    }

    const { data: events } = await eventQuery;

    const viewsMap: Record<string, number> = {};
    const wishlistMap: Record<string, number> = {};
    const cartMap: Record<string, number> = {};

    if (events) {
      for (const e of events) {
        if (!e.reference_id) continue;
        if (e.event_type === 'PRODUCT_VIEWED') {
          viewsMap[e.reference_id] = (viewsMap[e.reference_id] || 0) + 1;
        } else if (e.event_type === 'WISHLIST_ADDED') {
          wishlistMap[e.reference_id] = (wishlistMap[e.reference_id] || 0) + 1;
        } else if (e.event_type === 'CART_ADDED') {
          cartMap[e.reference_id] = (cartMap[e.reference_id] || 0) + 1;
        }
      }
    }

    // Sales from order_items joined with orders
    let orderQuery = this.supabase
      .from('orders')
      .select('id, payment_status, order_status, order_items(product_slug, product_name, quantity, line_total_paise)');

    if (startDate) {
      orderQuery = orderQuery.gte('created_at', startDate);
    }

    const { data: ordersWithItems } = await orderQuery;

    const map = new Map<string, ProductPerformanceMetric>();

    if (ordersWithItems) {
      for (const ord of ordersWithItems) {
        const isPaid = ord.payment_status === 'paid' ||
          ['confirmed', 'processing', 'shipped', 'delivered'].includes(ord.order_status);

        if (!isPaid) continue;

        const items = (ord.order_items as any[]) || [];
        for (const it of items) {
          const slug = it.product_slug;
          const existing = map.get(slug) || {
            productSlug: slug,
            productName: it.product_name,
            views: 0,
            wishlistAdds: 0,
            cartAdds: 0,
            purchases: 0,
            revenueRupees: 0,
            conversionRate: 0,
          };
          existing.purchases += Number(it.quantity) || 0;
          existing.revenueRupees += Math.round((Number(it.line_total_paise) || 0) / 100);
          map.set(slug, existing);
        }
      }
    }

    for (const [slug, count] of Object.entries(viewsMap)) {
      const existing = map.get(slug) || {
        productSlug: slug,
        productName: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        views: 0,
        wishlistAdds: 0,
        cartAdds: 0,
        purchases: 0,
        revenueRupees: 0,
        conversionRate: 0,
      };
      existing.views = count;
      map.set(slug, existing);
    }

    for (const [slug, count] of Object.entries(wishlistMap)) {
      const existing = map.get(slug);
      if (existing) existing.wishlistAdds = count;
    }

    for (const [slug, count] of Object.entries(cartMap)) {
      const existing = map.get(slug);
      if (existing) existing.cartAdds = count;
    }

    const results = Array.from(map.values());
    for (const item of results) {
      if (item.views > 0) {
        item.conversionRate = Number(((item.purchases / item.views) * 100).toFixed(1));
      }
    }

    return results.sort((a, b) => b.revenueRupees - a.revenueRupees || b.purchases - a.purchases || b.views - a.views);
  }

  /**
   * Aggregates multi-stage shopping funnel
   */
  public async getShoppingFunnel(period: string): Promise<FunnelStep[]> {
    const startDate = this.getStartDate(period);

    let eventQuery = this.supabase
      .from('customer_events')
      .select('event_type');

    if (startDate) {
      eventQuery = eventQuery.gte('created_at', startDate);
    }

    const { data: events } = await eventQuery;

    let viewsCount = 0;
    let cartCount = 0;
    let checkoutCount = 0;

    if (events) {
      for (const e of events) {
        if (e.event_type === 'PRODUCT_VIEWED') viewsCount++;
        else if (e.event_type === 'CART_ADDED') cartCount++;
        else if (e.event_type === 'CHECKOUT_STARTED') checkoutCount++;
      }
    }

    let orderQuery = this.supabase.from('orders').select('*', { count: 'exact', head: true });
    if (startDate) {
      orderQuery = orderQuery.gte('created_at', startDate);
    }
    const { count: ordersCountVal } = await orderQuery;
    const ordersCount = ordersCountVal || 0;

    if (checkoutCount === 0 && ordersCount > 0) {
      checkoutCount = Math.max(ordersCount, cartCount > 0 ? Math.round(cartCount * 0.7) : ordersCount);
    }

    return [
      {
        step: 'product_views',
        label: '1. Product Views',
        count: viewsCount,
        conversionRate: 100,
      },
      {
        step: 'cart_adds',
        label: '2. Added to Hamper',
        count: cartCount,
        conversionRate: viewsCount > 0 ? Number(((cartCount / viewsCount) * 100).toFixed(1)) : 0,
      },
      {
        step: 'checkout_started',
        label: '3. Checkout Initiated',
        count: checkoutCount,
        conversionRate: cartCount > 0 ? Number(((checkoutCount / cartCount) * 100).toFixed(1)) : 0,
      },
      {
        step: 'orders_completed',
        label: '4. Orders Placed',
        count: ordersCount,
        conversionRate: checkoutCount > 0 ? Number(((ordersCount / checkoutCount) * 100).toFixed(1)) : 0,
      },
    ];
  }
}

export const analyticsRepository = new AnalyticsRepository();
