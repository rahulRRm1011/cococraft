import crypto from 'crypto';
import { orderRepository } from '../repositories/order.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { orderEventRepository } from '../repositories/orderEvent.repository.js';
import { inventoryService } from './inventory.service.js';
import { engagementService } from './engagement.service.js';
import { engagementRepository } from '../repositories/engagement.repository.js';
import { OrderRecord } from '../types/order.js';
import {
  AdminOrderSummary,
  AdminOrderDetail,
  AdminOrderQuery,
  PaginatedResult,
  UnifiedTimelineEvent,
} from '../types/admin.js';

function formatAdminOrderSummary(order: OrderRecord): AdminOrderSummary {
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    subtotal: order.subtotal_paise / 100,
    shipping: order.shipping_paise / 100,
    discount: order.discount_paise / 100,
    grandTotal: order.grand_total_paise / 100,
    currency: order.currency,
    destinationCity: order.delivery_city,
    destinationState: order.delivery_state,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export class AdminOrderService {
  /**
   * Retrieves paginated orders for operations ledger
   */
  public async getOrders(query: AdminOrderQuery): Promise<PaginatedResult<any>> {
    const raw = await orderRepository.findOrdersPaginated(query);
    return {
      ...raw,
      items: raw.items.map(formatAdminOrderSummary),
    };
  }

  /**
   * Retrieves comprehensive order details, items, payment attempts, and unified timeline
   */
  public async getOrderDetail(orderId: string): Promise<AdminOrderDetail> {
    const order = await orderRepository.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const [items, payments, events] = await Promise.all([
      orderRepository.findOrderItems(orderId),
      paymentRepository.findPaymentsByOrderId(orderId),
      orderEventRepository.findEventsByOrderId(orderId),
    ]);

    // Build unified chronological timeline from order creation, order events, and payment attempts
    const timeline: UnifiedTimelineEvent[] = [];

    // 1. Initial order creation event
    timeline.push({
      id: `init_${order.id}`,
      timestamp: order.created_at,
      type: 'order_event',
      title: 'Order Placed',
      description: `Customer ${order.customer_name} placed order ${order.order_number} (${order.payment_method.toUpperCase()})`,
      actor: order.customer_name,
      statusBadge: order.order_status,
      metadata: {
        grandTotal: order.grand_total_paise / 100,
        currency: order.currency,
      },
    });

    // 2. Add payment attempts to timeline
    for (const payment of payments) {
      const isPaid = payment.status === 'paid';
      const isFailed = payment.status === 'failed';
      const isCancelled = payment.status === 'cancelled';

      let description = `Attempt ${payment.attempt_number} via ${payment.method.toUpperCase()} for ₹${(payment.amount_paise / 100).toLocaleString('en-IN')}`;
      if (isPaid) {
        description += ` • Successfully completed (${payment.payment_reference})`;
      } else if (isFailed) {
        description += ` • Declined: ${payment.failure_code || 'Simulated decline'}`;
      } else if (isCancelled) {
        description += ` • Cancelled by customer`;
      }

      timeline.push({
        id: `pay_${payment.id}`,
        timestamp: payment.completed_at || payment.updated_at || payment.created_at,
        type: 'payment_attempt',
        title: isPaid ? 'Payment Verified' : `Payment ${payment.status.toUpperCase()}`,
        description,
        actor: 'Payment Gateway',
        statusBadge: payment.status,
        metadata: {
          paymentReference: payment.payment_reference,
          attemptNumber: payment.attempt_number,
          failureCode: payment.failure_code,
        },
      });
    }

    // 3. Add operational audit events
    for (const event of events) {
      timeline.push({
        id: event.id,
        timestamp: event.createdAt,
        type: 'order_event',
        title: `Status Changed to ${event.toStatus?.toUpperCase()}`,
        description: event.note || `Order moved from ${event.fromStatus} to ${event.toStatus}`,
        actor: event.adminName || 'Atelier Staff',
        statusBadge: event.toStatus || undefined,
        metadata: {
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
        },
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      order,
      items,
      payments,
      timeline,
    };
  }

  /**
   * Updates an order's operational status with strict state machine validation and payment rules
   */
  public async updateOrderStatus(
    orderId: string,
    newStatus: string,
    adminUserId: string,
    note?: string
  ): Promise<OrderRecord> {
    const order = await orderRepository.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const currentStatus = order.order_status;
    const targetStatus = newStatus.trim().toLowerCase();

    // Prevent no-op
    if (currentStatus === targetStatus) {
      return order;
    }

    // State machine allowed transitions map
    const allowedTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [], // Terminal state
      cancelled: [], // Terminal state
    };

    const permitted = allowedTransitions[currentStatus] || [];
    if (!permitted.includes(targetStatus)) {
      throw new Error(
        `Invalid status transition from "${currentStatus}" to "${targetStatus}". Permitted transitions: ${permitted.join(', ') || 'None (Terminal state)'}.`
      );
    }

    // Payment-aware validation:
    // If moving from pending to confirmed, online orders MUST have payment_status === 'paid'
    if (currentStatus === 'pending' && targetStatus === 'confirmed') {
      if (order.payment_method !== 'cod' && order.payment_status !== 'paid') {
        throw new Error(
          'Online payment orders cannot be confirmed until payment is verified as paid.'
        );
      }
    }

    const updatedOrder = await orderRepository.updateOrderStatusAtomic(orderId, targetStatus, adminUserId, note);

    if (targetStatus === 'cancelled') {
      await inventoryService.returnOrderStock(orderId, adminUserId, note || 'Order cancelled by atelier admin');
    }

    // Engagement & Retention Triggers
    if (targetStatus === 'delivered') {
      await engagementService.awardLoyaltyPointsForOrder(orderId);

      if (order.customer_id) {
        await engagementRepository.createNotification({
          id: crypto.randomUUID(),
          customerId: order.customer_id,
          title: 'Order Delivered',
          message: `Your handcrafted pieces from order ${order.order_number} have arrived at your sanctuary. You can now leave a verified review!`,
          type: 'order',
          referenceType: 'order',
          referenceId: order.id,
        });
      }
    }

    if (targetStatus === 'shipped' && order.customer_id) {
      await engagementRepository.createNotification({
        id: crypto.randomUUID(),
        customerId: order.customer_id,
        title: 'Order Dispatched',
        message: `Your artisan order ${order.order_number} has been dispatched in eco-friendly packaging.`,
        type: 'order',
        referenceType: 'order',
        referenceId: order.id,
      });
    }

    return updatedOrder;
  }
}

export const adminOrderService = new AdminOrderService();
