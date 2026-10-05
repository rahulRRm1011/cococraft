import { BaseRepository } from './base.repository.js';
import {
  OrderRecord,
  OrderItemRecord,
} from '../types/order.js';

export interface CreateOrderParams {
  id: string;
  orderNumber: string;
  accessToken: string;
  cartId: string;
  idempotencyKey: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddressLine1: string;
  deliveryAddressLine2: string | null;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  taxPaise: number;
  grandTotalPaise: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  customerNote: string | null;
  customerId: string | null;
  couponCode: string | null;
}

export interface CreateOrderItemParams {
  orderId: string;
  productDocumentId: string;
  productSlug: string;
  productName: string;
  sku: string;
  productImageUrl: string | null;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}


export class OrderRepository extends BaseRepository {
  /**
   * Generates next sequential order number atomically
   */
  public async generateOrderNumber(year = new Date().getFullYear()): Promise<string> {
    // 1. Fetch current sequence value
    const { data: currentSeq } = await this.supabase
      .from('order_sequences')
      .select('current_val')
      .eq('name', 'order_number')
      .maybeSingle();

    let nextVal = 1;
    if (currentSeq) {
      nextVal = Number(currentSeq.current_val) + 1;
      await this.supabase
        .from('order_sequences')
        .update({ current_val: nextVal })
        .eq('name', 'order_number');
    } else {
      await this.supabase
        .from('order_sequences')
        .insert({ name: 'order_number', current_val: 1 });
    }

    return `CC-${year}-${String(nextVal).padStart(6, '0')}`;
  }

  /**
   * Executes database operations to insert order, order items, and clear originating cart
   */
  public async createOrderAtomic(
    orderParams: CreateOrderParams,
    itemsParams: CreateOrderItemParams[],
    originatingCartId: string | null
  ): Promise<{ order: OrderRecord; items: OrderItemRecord[] }> {
    // 1. Insert order record
    const { data: orderData, error: orderErr } = await this.supabase
      .from('orders')
      .insert({
        id: orderParams.id,
        order_number: orderParams.orderNumber,
        access_token: orderParams.accessToken,
        cart_id: orderParams.cartId,
        idempotency_key: orderParams.idempotencyKey,
        customer_name: orderParams.customerName,
        customer_email: orderParams.customerEmail,
        customer_phone: orderParams.customerPhone,
        delivery_address_line1: orderParams.deliveryAddressLine1,
        delivery_address_line2: orderParams.deliveryAddressLine2 || null,
        delivery_city: orderParams.deliveryCity,
        delivery_state: orderParams.deliveryState,
        delivery_postal_code: orderParams.deliveryPostalCode,
        delivery_country: orderParams.deliveryCountry || 'India',
        subtotal_paise: orderParams.subtotalPaise,
        shipping_paise: orderParams.shippingPaise,
        discount_paise: orderParams.discountPaise || 0,
        tax_paise: orderParams.taxPaise || 0,
        grand_total_paise: orderParams.grandTotalPaise,
        currency: orderParams.currency || 'INR',
        payment_method: orderParams.paymentMethod || 'cod',
        payment_status: orderParams.paymentStatus || 'unpaid',
        order_status: orderParams.orderStatus || 'confirmed',
        customer_note: orderParams.customerNote || null,
        customer_id: orderParams.customerId || null,
        coupon_code: orderParams.couponCode || null,
      })
      .select()
      .single();

    if (orderErr) {
      throw new Error(`Failed to create order: ${orderErr.message}`);
    }

    // 2. Insert item snapshots
    const formattedItems = itemsParams.map((item) => ({
      order_id: item.orderId,
      product_document_id: item.productDocumentId,
      product_slug: item.productSlug,
      product_name: item.productName,
      sku: item.sku,
      product_image_url: item.productImageUrl || null,
      quantity: item.quantity,
      unit_price_paise: item.unitPricePaise,
      line_total_paise: item.lineTotalPaise,
    }));

    const { data: itemsData, error: itemsErr } = await this.supabase
      .from('order_items')
      .insert(formattedItems)
      .select();

    if (itemsErr) {
      throw new Error(`Failed to create order items: ${itemsErr.message}`);
    }

    // 3. Clear originating cart items on successful order creation
    if (originatingCartId) {
      await this.supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', originatingCartId);

      await this.supabase
        .from('carts')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', originatingCartId);
    }

    return {
      order: orderData as OrderRecord,
      items: (itemsData || []) as OrderItemRecord[],
    };
  }

  /**
   * Finds an order by its ID
   */
  public async findOrderById(id: string): Promise<OrderRecord | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as OrderRecord;
  }

  /**
   * Finds an order by order number
   */
  public async findOrderByOrderNumber(orderNumber: string): Promise<OrderRecord | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error || !data) return null;
    return data as OrderRecord;
  }

  /**
   * Finds an order by idempotency key
   */
  public async findOrderByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    if (!key) return null;
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error || !data) return null;
    return data as OrderRecord;
  }

  /**
   * Retrieves all item snapshots for an order
   */
  public async findOrderItems(orderId: string): Promise<OrderItemRecord[]> {
    const { data, error } = await this.supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

    if (error || !data) return [];
    return data as OrderItemRecord[];
  }

  /**
   * Retrieves all orders for an authenticated customer with optional status filtering
   */
  public async findOrdersByCustomerId(customerId: string, statusFilter?: string): Promise<OrderRecord[]> {
    let query = this.supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId);

    if (statusFilter && statusFilter !== 'all') {
      const lower = statusFilter.toLowerCase();
      if (lower === 'processing') {
        query = query.in('order_status', ['pending', 'confirmed', 'processing']);
      } else if (lower === 'delivered') {
        query = query.eq('order_status', 'delivered');
      } else if (lower === 'cancelled') {
        query = query.eq('order_status', 'cancelled');
      } else {
        query = query.eq('order_status', lower);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as OrderRecord[];
  }

  /**
   * Retrieves an order strictly belonging to an authenticated customer
   */
  public async findCustomerOrderById(orderIdOrNumber: string, customerId: string): Promise<OrderRecord | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .or(`id.eq.${orderIdOrNumber},order_number.eq.${orderIdOrNumber}`)
      .maybeSingle();

    if (error || !data) return null;
    return data as OrderRecord;
  }

  /**
   * Paginated, searchable, filterable order listing for admin operations
   */
  public async findOrdersPaginated(query: {
    page?: number;
    limit?: number;
    search?: string;
    orderStatus?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortDir?: string;
    dateRange?: string;
  }): Promise<{ items: OrderRecord[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = this.supabase.from('orders').select('*', { count: 'exact' });

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      dbQuery = dbQuery.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%`);
    }

    if (query.orderStatus && query.orderStatus !== 'all') {
      dbQuery = dbQuery.eq('order_status', query.orderStatus);
    }

    if (query.paymentStatus && query.paymentStatus !== 'all') {
      dbQuery = dbQuery.eq('payment_status', query.paymentStatus);
    }

    if (query.paymentMethod && query.paymentMethod !== 'all') {
      dbQuery = dbQuery.eq('payment_method', query.paymentMethod);
    }

    if (query.dateRange === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      dbQuery = dbQuery.gte('created_at', startOfDay.toISOString());
    } else if (query.dateRange === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dbQuery = dbQuery.gte('created_at', sevenDaysAgo.toISOString());
    } else if (query.dateRange === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dbQuery = dbQuery.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const sortCol = query.sortBy === 'grand_total_paise' ? 'grand_total_paise' : query.sortBy === 'order_number' ? 'order_number' : 'created_at';
    const ascending = query.sortDir === 'asc';

    const { data, count, error } = await dbQuery
      .order(sortCol, { ascending })
      .range(from, to);

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: (data || []) as OrderRecord[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Updates order operational status and logs an audit event
   */
  public async updateOrderStatusAtomic(
    orderId: string,
    newStatus: string,
    adminUserId: string,
    note?: string
  ): Promise<OrderRecord> {
    const order = await this.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const prevStatus = order.order_status;
    const now = new Date().toISOString();

    const { data: updatedOrder, error } = await this.supabase
      .from('orders')
      .update({ order_status: newStatus, updated_at: now })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await this.supabase.from('order_events').insert({
      id: eventId,
      order_id: orderId,
      event_type: 'status_changed',
      from_status: prevStatus,
      to_status: newStatus,
      admin_user_id: adminUserId,
      note: note || `Status transitioned from ${prevStatus} to ${newStatus}`,
    });

    return updatedOrder as OrderRecord;
  }

  /**
   * Aggregates summary KPI metrics for operations dashboard
   */
  public async getDashboardSummary(dateRange = '30d') {
    let query = this.supabase.from('orders').select('*');

    if (dateRange === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startOfDay.toISOString());
    } else if (dateRange === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (dateRange === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const { data: orders } = await query;
    const allOrders = orders || [];

    const totalOrders = allOrders.length;
    const confirmedOrders = allOrders.filter((o) => o.order_status === 'confirmed').length;
    const pendingOrders = allOrders.filter((o) => o.order_status === 'pending').length;
    const cancelledOrders = allOrders.filter((o) => o.order_status === 'cancelled').length;

    const totalOrderValuePaise = allOrders
      .filter((o) => o.order_status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.grand_total_paise || 0), 0);

    const paidOnlineValuePaise = allOrders
      .filter((o) => o.payment_status === 'paid' && o.payment_method !== 'cod')
      .reduce((sum, o) => sum + Number(o.grand_total_paise || 0), 0);

    const codOrderValuePaise = allOrders
      .filter((o) => o.payment_method === 'cod' && o.order_status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.grand_total_paise || 0), 0);

    // Today's metrics
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayOrdersList = allOrders.filter((o) => new Date(o.created_at) >= startOfDay);
    const todayOrders = todayOrdersList.length;
    const todayOrderValuePaise = todayOrdersList
      .filter((o) => o.order_status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.grand_total_paise || 0), 0);

    // Failed payments count
    const { count: failedPayments } = await this.supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    return {
      totalOrders,
      confirmedOrders,
      pendingOrders,
      cancelledOrders,
      totalOrderValuePaise,
      totalOrderValue: Math.round(totalOrderValuePaise / 100),
      paidOnlineValuePaise,
      paidOnlineValue: Math.round(paidOnlineValuePaise / 100),
      codOrderValuePaise,
      codOrderValue: Math.round(codOrderValuePaise / 100),
      failedPaymentAttempts: failedPayments || 0,
      todayOrders,
      todayOrderValuePaise,
      todayOrderValue: Math.round(todayOrderValuePaise / 100),
    };
  }

  /**
   * Retrieves aggregated order volume trend over time
   */
  public async getOrderTrend(dateRange = '30d') {
    let query = this.supabase.from('orders').select('created_at, grand_total_paise, order_status');

    if (dateRange === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startOfDay.toISOString());
    } else if (dateRange === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (dateRange === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const { data: rows } = await query.order('created_at', { ascending: true });
    const orderList = rows || [];

    const map = new Map<string, { ordersCount: number; valuePaise: number }>();
    for (const o of orderList) {
      const date = o.created_at.substring(0, 10);
      const entry = map.get(date) || { ordersCount: 0, valuePaise: 0 };
      entry.ordersCount += 1;
      if (o.order_status !== 'cancelled') {
        entry.valuePaise += Number(o.grand_total_paise || 0);
      }
      map.set(date, entry);
    }

    return Array.from(map.entries()).map(([date, val]) => ({
      date,
      ordersCount: val.ordersCount,
      valuePaise: val.valuePaise,
      value: Math.round(val.valuePaise / 100),
    }));
  }

  /**
   * Retrieves payment method distribution
   */
  public async getPaymentMethodDistribution(dateRange = '30d') {
    let query = this.supabase.from('orders').select('payment_method, grand_total_paise, created_at');

    if (dateRange === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startOfDay.toISOString());
    } else if (dateRange === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (dateRange === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const { data: rows } = await query;
    const list = rows || [];

    const map = new Map<string, { count: number; totalPaise: number }>();
    for (const o of list) {
      const method = o.payment_method || 'cod';
      const entry = map.get(method) || { count: 0, totalPaise: 0 };
      entry.count += 1;
      entry.totalPaise += Number(o.grand_total_paise || 0);
      map.set(method, entry);
    }

    return Array.from(map.entries()).map(([method, val]) => ({
      method,
      count: val.count,
      totalPaise: val.totalPaise,
      total: Math.round(val.totalPaise / 100),
    }));
  }

  /**
   * Retrieves order status distribution
   */
  public async getOrderStatusDistribution(dateRange = '30d') {
    let query = this.supabase.from('orders').select('order_status, created_at');

    if (dateRange === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startOfDay.toISOString());
    } else if (dateRange === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (dateRange === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const { data: rows } = await query;
    const list = rows || [];

    const map = new Map<string, number>();
    for (const o of list) {
      const status = o.order_status || 'confirmed';
      map.set(status, (map.get(status) || 0) + 1);
    }

    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }

  /**
   * Retrieves recent orders for dashboard
   */
  public async getRecentOrders(limit = 6): Promise<OrderRecord[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as OrderRecord[];
  }
}

export const orderRepository = new OrderRepository();
