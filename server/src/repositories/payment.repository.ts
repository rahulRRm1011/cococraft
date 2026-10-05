import { BaseRepository } from './base.repository.js';
import { PaymentRecord, PaymentStatus, PaymentMethod } from '../types/payment.js';
import { OrderRecord } from '../types/order.js';

export interface CreatePaymentParams {
  id: string;
  orderId: string;
  paymentReference: string;
  provider: string;
  method: PaymentMethod;
  amountPaise: number;
  currency: string;
  idempotencyKey: string | null;
}

export class PaymentRepository extends BaseRepository {
  /**
   * Generates next unique payment reference
   */
  public async generatePaymentReference(year = new Date().getFullYear()): Promise<string> {
    const { data: currentSeq } = await this.supabase
      .from('order_sequences')
      .select('current_val')
      .eq('name', 'payment_reference')
      .maybeSingle();

    let nextVal = 1;
    if (currentSeq) {
      nextVal = Number(currentSeq.current_val) + 1;
      await this.supabase
        .from('order_sequences')
        .update({ current_val: nextVal })
        .eq('name', 'payment_reference');
    } else {
      await this.supabase
        .from('order_sequences')
        .insert({ name: 'payment_reference', current_val: 1 });
    }

    return `CCPAY-${year}-${String(nextVal).padStart(6, '0')}`;
  }

  /**
   * Creates a new payment attempt row with sequential attempt_number
   */
  public async createPaymentAttempt(params: CreatePaymentParams): Promise<PaymentRecord> {
    // Determine next attempt number for this order
    const { data: attempts } = await this.supabase
      .from('payments')
      .select('attempt_number')
      .eq('order_id', params.orderId)
      .order('attempt_number', { ascending: false })
      .limit(1);

    const attemptNumber = attempts && attempts.length > 0 ? (Number(attempts[0].attempt_number) || 0) + 1 : 1;

    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        id: params.id,
        order_id: params.orderId,
        payment_reference: params.paymentReference,
        provider: params.provider,
        method: params.method,
        amount_paise: params.amountPaise,
        currency: params.currency,
        status: 'created',
        attempt_number: attemptNumber,
        idempotency_key: params.idempotencyKey,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment attempt: ${error.message}`);
    }

    return data as PaymentRecord;
  }

  /**
   * Finds a payment record by ID
   */
  public async findPaymentById(id: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as PaymentRecord;
  }

  /**
   * Finds a payment record by reference (e.g. CCPAY-2026-000001)
   */
  public async findPaymentByReference(reference: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();

    if (error || !data) return null;
    return data as PaymentRecord;
  }

  /**
   * Finds a payment record by idempotency key
   */
  public async findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    if (!key) return null;
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error || !data) return null;
    return data as PaymentRecord;
  }

  /**
   * Finds all payment attempts for a given order
   */
  public async findPaymentsByOrderId(orderId: string): Promise<PaymentRecord[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('attempt_number', { ascending: true });

    if (error || !data) return [];
    return data as PaymentRecord[];
  }

  /**
   * Checks if an order already has a successfully paid payment
   */
  public async findSuccessfulPaymentForOrder(orderId: string): Promise<PaymentRecord | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'paid')
      .maybeSingle();

    if (error || !data) return null;
    return data as PaymentRecord;
  }

  /**
   * Updates payment record status and failure details
   */
  public async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    extra?: {
      providerReference?: string;
      failureCode?: string;
      failureMessage?: string;
      method?: PaymentMethod;
    }
  ): Promise<PaymentRecord> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (extra?.providerReference !== undefined) updates.provider_reference = extra.providerReference;
    if (extra?.failureCode !== undefined) updates.failure_code = extra.failureCode;
    if (extra?.failureMessage !== undefined) updates.failure_message = extra.failureMessage;
    if (extra?.method !== undefined) updates.method = extra.method;

    const { data, error } = await this.supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    return data as PaymentRecord;
  }

  /**
   * Finalizes a successful payment:
   * 1. Marks payment as paid
   * 2. Marks order as paid & confirmed
   * 3. Clears originating cart items
   */
  public async finalizeSuccessfulPaymentAtomic(
    paymentId: string,
    orderId: string,
    method: PaymentMethod,
    originatingCartId: string | null,
    providerReference: string
  ): Promise<{ payment: PaymentRecord; order: OrderRecord }> {
    // 1. Guard against duplicate successful payment
    const { data: existingPaid } = await this.supabase
      .from('payments')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'paid')
      .neq('id', paymentId)
      .maybeSingle();

    if (existingPaid) {
      throw new Error('Order has already been paid by a concurrent payment attempt.');
    }

    // 2. Mark payment paid
    const { data: paymentData, error: paymentErr } = await this.supabase
      .from('payments')
      .update({
        status: 'paid',
        method,
        provider_reference: providerReference,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (paymentErr) {
      throw new Error(`Failed to update payment record: ${paymentErr.message}`);
    }

    // 3. Update order state
    const { data: orderData, error: orderErr } = await this.supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: method,
        order_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (orderErr) {
      throw new Error(`Failed to update order record: ${orderErr.message}`);
    }

    // 4. Clear originating cart now that payment has succeeded
    if (originatingCartId) {
      await this.supabase.from('cart_items').delete().eq('cart_id', originatingCartId);
      await this.supabase
        .from('carts')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', originatingCartId);
    }

    return { payment: paymentData as PaymentRecord, order: orderData as OrderRecord };
  }

  /**
   * Creates an HttpOnly guest order session record
   */
  public async createGuestOrderSession(sessionToken: string, orderId: string, ttlHours = 48): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
    await this.supabase
      .from('guest_order_sessions')
      .upsert({
        session_token: sessionToken,
        order_id: orderId,
        expires_at: expiresAt,
      });
  }

  /**
   * Verifies if a guest order session is valid and active for an orderId
   */
  public async isGuestOrderSessionValid(sessionToken: string, orderId: string): Promise<boolean> {
    if (!sessionToken || !orderId) return false;
    const { data } = await this.supabase
      .from('guest_order_sessions')
      .select('session_token')
      .eq('session_token', sessionToken)
      .eq('order_id', orderId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    return Boolean(data);
  }

  /**
   * Paginated, searchable payment listing with linked order metadata for admin operations
   */
  public async findPaymentsPaginated(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    method?: string;
    dateRange?: string;
  }): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    let queryBuilder = this.supabase
      .from('payments')
      .select('*, orders!inner(order_number, customer_name, customer_email)', { count: 'exact' });

    if (query.status && query.status !== 'all') {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    if (query.method && query.method !== 'all') {
      queryBuilder = queryBuilder.eq('method', query.method);
    }

    if (query.dateRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      queryBuilder = queryBuilder.gte('created_at', today.toISOString());
    } else if (query.dateRange === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      queryBuilder = queryBuilder.gte('created_at', sevenDaysAgo.toISOString());
    } else if (query.dateRange === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      queryBuilder = queryBuilder.gte('created_at', thirtyDaysAgo.toISOString());
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      queryBuilder = queryBuilder.or(`payment_reference.ilike.%${term}%,orders.order_number.ilike.%${term}%,orders.customer_name.ilike.%${term}%`);
    }

    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await queryBuilder;
    if (error) {
      throw new Error(`Failed to query payments: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const items = (data || []).map((row: any) => ({
      ...row,
      order_number: row.orders?.order_number,
      customer_name: row.orders?.customer_name,
      customer_email: row.orders?.customer_email,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves recent payment attempts with linked order number
   */
  public async getRecentPayments(limit = 6): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*, orders!inner(order_number, customer_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      ...row,
      order_number: row.orders?.order_number,
      customer_name: row.orders?.customer_name,
    }));
  }
}

export const paymentRepository = new PaymentRepository();
