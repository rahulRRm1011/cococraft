import crypto from 'crypto';
import { paymentRepository } from '../repositories/payment.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { mockPaymentProvider } from './mockPaymentProvider.js';
import {
  PaymentRecord,
  PaymentResponse,
  InitiatePaymentInput,
  ProcessPaymentInput,
  PaymentMethod,
  PaymentStatus,
} from '../types/payment.js';
import { OrderRecord } from '../types/order.js';

export class PaymentService {
  /**
   * Initiates a new payment attempt for an order
   */
  public async initiatePayment(
    input: InitiatePaymentInput,
    idempotencyKey?: string
  ): Promise<PaymentResponse> {
    if (!input?.orderId) {
      throw new Error('Order ID is required to initiate payment.');
    }

    const validMethods: PaymentMethod[] = ['upi', 'card', 'netbanking', 'cod'];
    const method = input.method || 'upi';
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid payment method "${input.method}". Allowed methods: ${validMethods.join(', ')}`);
    }

    const key = (idempotencyKey || input.idempotencyKey || '').trim() || null;
    if (key) {
      const existing = await paymentRepository.findPaymentByIdempotencyKey(key);
      if (existing) {
        const order = await orderRepository.findOrderById(existing.order_id);
        return this.formatPaymentResponse(existing, order);
      }
    }

    // 1. Fetch order - this is the ONLY authority on payment amount
    const order = await orderRepository.findOrderById(input.orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    // 2. Reject if order is already paid
    if (order.payment_status === 'paid') {
      throw new Error('This order has already been paid and confirmed.');
    }

    const paidPayment = await paymentRepository.findSuccessfulPaymentForOrder(order.id);
    if (paidPayment) {
      throw new Error('A successful payment already exists for this order.');
    }

    if (order.order_status === 'cancelled') {
      throw new Error('Cannot initiate payment for a cancelled order.');
    }

    // Ensure stock reservation is active for this order (re-reserve on payment retry if previously released)
    const { inventoryService } = await import('./inventory.service.js');
    const existingReservations = await inventoryService.getRepository().getReservations({ orderId: order.id });
    const hasActiveReservation = existingReservations.some((r) => r.status === 'reserved');
    if (!hasActiveReservation) {
      const orderItems = await orderRepository.findOrderItems(order.id);
      const itemsToReserve = orderItems.map((it) => ({
        productReference: it.product_document_id,
        quantity: it.quantity,
      }));
      await inventoryService.reserveOrderStock(order.id, itemsToReserve);
    }

    // 3. Generate secure identifiers
    const paymentId = crypto.randomUUID();
    const paymentReference = await paymentRepository.generatePaymentReference();

    // 4. Create attempt record with server-authoritative amount from order
    const payment = await paymentRepository.createPaymentAttempt({
      id: paymentId,
      orderId: order.id,
      paymentReference,
      provider: mockPaymentProvider.providerName,
      method,
      amountPaise: order.grand_total_paise, // SERVER AUTHORITATIVE
      currency: order.currency,
      idempotencyKey: key,
    });

    return this.formatPaymentResponse(payment, order);
  }

  /**
   * Processes a simulated payment action (success, failure, pending, or cancel)
   */
  public async processPayment(
    paymentId: string,
    input: ProcessPaymentInput,
    _idempotencyKey?: string
  ): Promise<PaymentResponse> {
    if (!paymentId) {
      throw new Error('Payment ID is required.');
    }

    // 1. Fetch payment attempt
    const payment = await paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment attempt not found.');
    }

    // 2. Fetch corresponding order
    const order = await orderRepository.findOrderById(payment.order_id);
    if (!order) {
      throw new Error('Corresponding order not found.');
    }

    // 3. Idempotent early-return if this payment attempt is ALREADY paid
    if (payment.status === 'paid') {
      return this.formatPaymentResponse(payment, order);
    }

    // 4. Multi-tab protection: check if the order was already paid by another attempt
    if (order.payment_status === 'paid') {
      await paymentRepository.updatePaymentStatus(payment.id, 'failed', {
        failureCode: 'ORDER_ALREADY_PAID',
        failureMessage: 'This order has already been successfully paid in another session.',
      });
      throw new Error('Order has already been paid and confirmed in another session.');
    }

    // 5. Permitted transitions: can only process payments in created, pending, or processing status
    const processableStatuses: PaymentStatus[] = ['created', 'pending', 'processing'];
    if (!processableStatuses.includes(payment.status)) {
      throw new Error(
        `Cannot process payment attempt with status "${payment.status}". Please initiate a new payment attempt.`
      );
    }

    const selectedMethod = input.method || payment.method;

    // 6. Delegate to mock provider abstraction
    const result = await mockPaymentProvider.process(payment, input);

    const { inventoryService } = await import('./inventory.service.js');

    if (result.status === 'paid') {
      // Atomic transaction:
      // updates payment to 'paid', order to 'paid' & 'confirmed', and clears originating cart
      const { payment: finalizedPayment, order: finalizedOrder } =
        await paymentRepository.finalizeSuccessfulPaymentAtomic(
          payment.id,
          order.id,
          selectedMethod,
          order.cart_id,
          result.providerReference
        );

      // Finalize stock reservation: deduct available and mark sold
      await inventoryService.finalizeOrderStock(order.id);

      // Create an authorized guest order session for URL-free confirmation access
      await paymentRepository.createGuestOrderSession(finalizedOrder.access_token, finalizedOrder.id, 48);

      return this.formatPaymentResponse(finalizedPayment, finalizedOrder);
    }

    if (result.status === 'pending') {
      const updated = await paymentRepository.updatePaymentStatus(payment.id, 'pending', {
        providerReference: result.providerReference,
        failureMessage: result.failureMessage,
        method: selectedMethod,
      });
      return this.formatPaymentResponse(updated, order);
    }

    if (result.status === 'cancelled') {
      const updated = await paymentRepository.updatePaymentStatus(payment.id, 'cancelled', {
        providerReference: result.providerReference,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        method: selectedMethod,
      });
      // Release reserved stock so other shoppers can purchase
      await inventoryService.releaseOrderStock(order.id, result.failureMessage || 'Payment cancelled by customer');
      return this.formatPaymentResponse(updated, order);
    }

    // Default: failed payment
    const updated = await paymentRepository.updatePaymentStatus(payment.id, 'failed', {
      providerReference: result.providerReference,
      failureCode: result.failureCode,
      failureMessage: result.failureMessage,
      method: selectedMethod,
    });
    // Release reserved stock so other shoppers can purchase
    await inventoryService.releaseOrderStock(order.id, result.failureMessage || 'Payment attempt failed');
    return this.formatPaymentResponse(updated, order);
  }

  /**
   * Retrieves payment status and associated order summary
   */
  public async getPayment(paymentId: string): Promise<PaymentResponse> {
    if (!paymentId) {
      throw new Error('Payment ID is required.');
    }

    const payment = await paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment attempt not found.');
    }

    const order = await orderRepository.findOrderById(payment.order_id);
    return this.formatPaymentResponse(payment, order);
  }

  /**
   * Reconciles / verifies a pending payment attempt
   */
  public async verifyPendingPayment(paymentId: string): Promise<PaymentResponse> {
    const payment = await paymentRepository.findPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment attempt not found.');
    }

    const order = await orderRepository.findOrderById(payment.order_id);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (payment.status === 'paid') {
      return this.formatPaymentResponse(payment, order);
    }

    const result = await mockPaymentProvider.verify(payment);

    if (result.status === 'paid') {
      const { payment: finalizedPayment, order: finalizedOrder } =
        await paymentRepository.finalizeSuccessfulPaymentAtomic(
          payment.id,
          order.id,
          payment.method,
          order.cart_id,
          result.providerReference
        );

      const { inventoryService } = await import('./inventory.service.js');
      await inventoryService.finalizeOrderStock(order.id);

      await paymentRepository.createGuestOrderSession(finalizedOrder.access_token, finalizedOrder.id, 48);
      return this.formatPaymentResponse(finalizedPayment, finalizedOrder);
    }

    return this.formatPaymentResponse(payment, order);
  }

  /**
   * Retrieves full payment attempt history for an order
   */
  public async getPaymentHistory(orderId: string): Promise<PaymentResponse[]> {
    const payments = await paymentRepository.findPaymentsByOrderId(orderId);
    const order = await orderRepository.findOrderById(orderId);
    return Promise.all(payments.map((p) => this.formatPaymentResponse(p, order)));
  }

  /**
   * Formats database payment record into clean external API representation
   */
  public async formatPaymentResponse(payment: PaymentRecord, order: OrderRecord | null): Promise<PaymentResponse> {
    let orderSummary = undefined;

    if (order) {
      const items = await orderRepository.findOrderItems(order.id);
      orderSummary = {
        id: order.id,
        orderNumber: order.order_number,
        grandTotal: order.grand_total_paise / 100,
        grandTotalPaise: order.grand_total_paise,
        currency: order.currency,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        itemsCount: items.reduce((acc, item) => acc + item.quantity, 0),
      };
    }

    return {
      id: payment.id,
      orderId: payment.order_id,
      paymentReference: payment.payment_reference,
      provider: payment.provider,
      method: payment.method,
      amount: payment.amount_paise / 100,
      amountPaise: payment.amount_paise,
      currency: payment.currency,
      status: payment.status,
      attemptNumber: payment.attempt_number,
      providerReference: payment.provider_reference,
      failureCode: payment.failure_code,
      failureMessage: payment.failure_message,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      completedAt: payment.completed_at,
      order: orderSummary,
    };
  }
}

export const paymentService = new PaymentService();
