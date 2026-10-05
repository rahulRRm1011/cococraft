import { BaseRepository } from './base.repository.js';
import { OrderEventRecord, OrderEvent } from '../types/admin.js';

export interface CreateOrderEventParams {
  id: string;
  orderId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  adminUserId?: string | null;
  note?: string | null;
}

export class OrderEventRepository extends BaseRepository {
  /**
   * Records an audit event for an order
   */
  public async createEvent(params: CreateOrderEventParams): Promise<OrderEvent> {
    const { data, error } = await this.supabase
      .from('order_events')
      .insert({
        id: params.id,
        order_id: params.orderId,
        event_type: params.eventType,
        from_status: params.fromStatus || null,
        to_status: params.toStatus || null,
        admin_user_id: params.adminUserId || null,
        note: params.note || null,
      })
      .select('*, admin_users(display_name)')
      .single();

    if (error) {
      throw new Error(`Failed to create order event: ${error.message}`);
    }

    return this.toDTO(data);
  }

  /**
   * Finds event by ID
   */
  public async findEventById(id: string): Promise<OrderEvent | null> {
    const { data, error } = await this.supabase
      .from('order_events')
      .select('*, admin_users(display_name)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.toDTO(data);
  }

  /**
   * Retrieves all audit events for an order chronologically
   */
  public async findEventsByOrderId(orderId: string): Promise<OrderEvent[]> {
    const { data, error } = await this.supabase
      .from('order_events')
      .select('*, admin_users(display_name)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error || !data) return [];
    return data.map((r) => this.toDTO(r));
  }

  /**
   * Converts record to DTO
   */
  public toDTO(record: any): OrderEvent {
    const adminName = record.admin_users?.display_name || record.admin_name || null;
    return {
      id: record.id,
      orderId: record.order_id,
      eventType: record.event_type,
      fromStatus: record.from_status,
      toStatus: record.to_status,
      adminUserId: record.admin_user_id,
      adminName,
      note: record.note,
      createdAt: record.created_at,
    };
  }
}

export const orderEventRepository = new OrderEventRepository();
