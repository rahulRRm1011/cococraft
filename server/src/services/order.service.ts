import crypto from 'crypto';
import { config } from '../config/env.js';
import { cartRepository } from '../repositories/cart.repository.js';
import { orderRepository, CreateOrderParams, CreateOrderItemParams } from '../repositories/order.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { catalogService } from './catalog.service.js';
import { isValidIndianState } from '../utils/indiaStates.js';
import {
  CreateOrderInput,
  OrderResponse,
  OrderItemResponse,
  OrderRecord,
  OrderItemRecord,
  ShippingConfigResponse,
} from '../types/order.js';

export class OrderService {
  /**
   * Validates customer and delivery address fields with India-specific rules
   */
  public validateOrderInput(input: CreateOrderInput): void {
    if (!input) {
      throw new Error('Order creation payload is missing.');
    }

    if (!input.cartId || typeof input.cartId !== 'string' || !input.cartId.trim()) {
      throw new Error('A valid cart session ID is required to place an order.');
    }

    // Customer validation
    const customer = input.customer;
    if (!customer) {
      throw new Error('Customer contact information is required.');
    }

    const name = customer.name?.trim();
    if (!name || name.length < 2 || name.length > 100) {
      throw new Error('Please enter a valid customer name (2 to 100 characters).');
    }

    const email = customer.email?.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email.length > 150 || !emailRegex.test(email)) {
      throw new Error('Please enter a valid email address.');
    }

    const phoneRaw = customer.phone?.trim();
    // Support Indian mobile numbers with optional spaces/hyphens: optional +91 or 0 prefix, then 10 digits starting with 6-9
    const phoneCleaned = phoneRaw?.replace(/[\s\-\(\)]/g, '') || '';
    const indianPhoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;
    if (!phoneCleaned || !indianPhoneRegex.test(phoneCleaned)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
    }

    // Delivery address validation
    const addr = input.deliveryAddress;
    if (!addr) {
      throw new Error('Delivery address details are required.');
    }

    const line1 = addr.line1?.trim();
    if (!line1 || line1.length < 5 || line1.length > 200) {
      throw new Error('Please enter a valid street address (5 to 200 characters).');
    }

    if (addr.line2 && addr.line2.trim().length > 200) {
      throw new Error('Address Line 2 cannot exceed 200 characters.');
    }

    const city = addr.city?.trim();
    if (!city || city.length < 2 || city.length > 100) {
      throw new Error('Please enter a valid city name.');
    }

    const state = addr.state?.trim();
    if (!state || !isValidIndianState(state)) {
      throw new Error('Please select a valid Indian State or Union Territory.');
    }

    const postalCode = addr.postalCode?.trim();
    // 6-digit Indian PIN code
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!postalCode || !pinRegex.test(postalCode)) {
      throw new Error('Please enter a valid 6-digit Indian PIN code (cannot start with 0).');
    }

    if (addr.country && addr.country.trim().toLowerCase() !== 'india') {
      throw new Error('At this time, orders can only be shipped to addresses within India.');
    }

    // Customer note validation
    if (input.customerNote && input.customerNote.trim().length > 500) {
      throw new Error('Customer note cannot exceed 500 characters.');
    }
  }

  /**
   * Normalizes Indian mobile number to 10 digits for storage
   */
  public normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.slice(1);
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2);
    return cleaned;
  }

  /**
   * Returns current shipping rule configuration
   */
  public getShippingConfig(): ShippingConfigResponse {
    return {
      freeShippingThreshold: config.freeShippingThresholdPaise / 100,
      standardShippingFee: config.standardShippingPaise / 100,
      freeShippingThresholdPaise: config.freeShippingThresholdPaise,
      standardShippingPaise: config.standardShippingPaise,
    };
  }

  /**
   * Creates an order from a persistent guest cart using an atomic Supabase operation
   */
  public async createOrder(
    input: CreateOrderInput,
    idempotencyKeyHeader?: string,
    authenticatedCustomerId?: string
  ): Promise<OrderResponse> {
    // 1. Resolve idempotency key
    const idempotencyKey = (idempotencyKeyHeader || input.idempotencyKey || '').trim() || null;

    if (idempotencyKey) {
      const existingOrder = await orderRepository.findOrderByIdempotencyKey(idempotencyKey);
      if (existingOrder) {
        const existingItems = await orderRepository.findOrderItems(existingOrder.id);
        return this.formatOrderResponse(existingOrder, existingItems);
      }
    }

    // 2. Validate input format and values
    this.validateOrderInput(input);

    const cartId = input.cartId.trim();

    // 3. Confirm cart exists and is active
    const cart = await cartRepository.findCartById(cartId);
    if (!cart) {
      throw new Error('Shopping hamper not found or session has expired.');
    }

    // 4. Retrieve cart items
    const cartItems = await cartRepository.findCartItems(cartId);
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Your shopping hamper is empty. Add products to proceed with checkout.');
    }

    // 5. Validate every product against trusted Strapi catalog service
    // Snapshot items with server-authoritative prices, names, SKUs, and images
    const snapshotItems: CreateOrderItemParams[] = [];
    let subtotalPaise = 0;
    const orderId = crypto.randomUUID();

    for (const item of cartItems) {
      const product = await catalogService.getProductByDocumentId(item.product_document_id);

      if (!product) {
        throw new Error(
          'One of the pieces in your hamper is no longer available. Please review your hamper before continuing.'
        );
      }

      if (!product.isActive) {
        throw new Error(
          `The item "${product.name}" is no longer active in our collection. Please remove it from your hamper.`
        );
      }

      if (product.stockStatus === 'out_of_stock') {
        throw new Error(
          `"${product.name}" is currently out of stock. Please adjust your hamper before completing your order.`
        );
      }

      // Authoritative server-side price calculation in integer paise
      const unitPricePaise = Math.round(product.price * 100);
      const lineTotalPaise = unitPricePaise * item.quantity;
      subtotalPaise += lineTotalPaise;

      snapshotItems.push({
        orderId,
        productDocumentId: product.documentId || item.product_document_id,
        productSlug: product.slug,
        productName: product.name,
        sku: product.sku || product.slug,
        productImageUrl: product.images?.[0] || null,
        quantity: item.quantity,
        unitPricePaise,
        lineTotalPaise,
      });
    }

    // 5b. Validate sellable stock against Business Inventory Control Layer
    const { inventoryRepository } = await import('../repositories/inventory.repository.js');
    for (const item of cartItems) {
      const inv = await inventoryRepository.findByProductReference(item.product_document_id || item.product_slug);
      if (inv) {
        if (inv.sellable_quantity < item.quantity) {
          throw new Error(
            `Unable to complete order: Insufficient stock for "${inv.sku}". Available: ${inv.sellable_quantity}, requested: ${item.quantity}.`
          );
        }
      }
    }

    // 6. Apply server-side shipping rules & coupon discounts
    const shippingPaise =
      subtotalPaise >= config.freeShippingThresholdPaise ? 0 : config.standardShippingPaise;
    let discountPaise = 0;
    let appliedCouponCode: string | null = null;
    let couponToRecordId: string | null = null;

    if (input.couponCode && input.couponCode.trim()) {
      const { engagementService } = await import('./engagement.service.js');
      const couponRes = await engagementService.validateCoupon(input.couponCode.trim(), subtotalPaise);
      if (!couponRes.valid || !couponRes.coupon) {
        throw new Error(couponRes.message || 'The coupon code entered is invalid or expired.');
      }
      discountPaise = couponRes.discountPaise;
      appliedCouponCode = couponRes.coupon.code;
      couponToRecordId = couponRes.coupon.id;
    }

    const taxPaise = 0;
    const grandTotalPaise = Math.max(0, subtotalPaise + shippingPaise + taxPaise - discountPaise);

    // 7. Generate secure guest confirmation access token
    const accessToken = crypto.randomBytes(24).toString('hex');

    // 8. Generate sequential order number
    const orderNumber = await orderRepository.generateOrderNumber();

    const isOnlinePayment = input.paymentMethod === 'online';
    const paymentMethod = isOnlinePayment ? 'online' : 'cod';
    const orderStatus = isOnlinePayment ? 'pending' : 'confirmed';
    // For online payments, preserve cart until payment completes. For COD, clear cart immediately.
    const cartIdToClear = isOnlinePayment ? null : cartId;

    // 9. Prepare order parameters
    const orderParams: CreateOrderParams = {
      id: orderId,
      orderNumber,
      accessToken,
      cartId,
      idempotencyKey,
      customerName: input.customer.name.trim(),
      customerEmail: input.customer.email.trim().toLowerCase(),
      customerPhone: this.normalizePhoneNumber(input.customer.phone),
      deliveryAddressLine1: input.deliveryAddress.line1.trim(),
      deliveryAddressLine2: input.deliveryAddress.line2?.trim() || null,
      deliveryCity: input.deliveryAddress.city.trim(),
      deliveryState: input.deliveryAddress.state.trim(),
      deliveryPostalCode: input.deliveryAddress.postalCode.trim(),
      deliveryCountry: 'India',
      subtotalPaise,
      shippingPaise,
      discountPaise,
      taxPaise,
      grandTotalPaise,
      currency: 'INR',
      paymentMethod,
      paymentStatus: 'unpaid',
      orderStatus,
      customerNote: input.customerNote?.trim() || null,
      customerId: authenticatedCustomerId || input.customerId || null,
      couponCode: appliedCouponCode,
    };

    // 10. Execute atomic transaction (insert order, insert snapshots, clear cart if COD)
    const { order, items } = await orderRepository.createOrderAtomic(
      orderParams,
      snapshotItems,
      cartIdToClear
    );

    // If coupon was applied, increment its used_count
    if (couponToRecordId) {
      const { engagementService } = await import('./engagement.service.js');
      await engagementService.recordCouponUsage(couponToRecordId);
    }

    // 11. Reserve inventory to prevent overselling
    const { inventoryService } = await import('./inventory.service.js');
    const itemsToReserve = snapshotItems.map((si) => ({
      productReference: si.productDocumentId,
      quantity: si.quantity,
    }));
    await inventoryService.reserveOrderStock(order.id, itemsToReserve);

    // For COD: finalize stock allocation immediately upon order confirmation
    if (paymentMethod === 'cod') {
      await inventoryService.finalizeOrderStock(order.id);
    }

    // Track order completed event
    if (order.customer_id) {
      const { engagementService } = await import('./engagement.service.js');
      await engagementService.recordActivity(order.customer_id, 'ORDER_COMPLETED', order.id, {
        orderNumber: order.order_number,
        grandTotalPaise: order.grand_total_paise,
      });
    }

    // Register active guest order session
    await paymentRepository.createGuestOrderSession(accessToken, order.id, 48);

    return this.formatOrderResponse(order, items);
  }

  /**
   * Retrieves order confirmation securely via opaque access token or active HttpOnly session
   */
  public async getOrderConfirmation(orderId: string, token?: string, sessionToken?: string): Promise<OrderResponse> {
    if (!orderId) {
      throw new Error('Order reference is required.');
    }

    const order = await orderRepository.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    // Verify either query/header token OR active session cookie
    const hasValidToken = token && order.access_token === token.trim();
    const hasValidSession = sessionToken && (await paymentRepository.isGuestOrderSessionValid(sessionToken, order.id));

    if (!hasValidToken && !hasValidSession) {
      const forbiddenError: any = new Error('Invalid or expired confirmation access token.');
      forbiddenError.statusCode = 403;
      throw forbiddenError;
    }

    const items = await orderRepository.findOrderItems(order.id);
    return this.formatOrderResponse(order, items);
  }

  /**
   * Formats database records into clean external API representation
   */
  public formatOrderResponse(order: OrderRecord, items: OrderItemRecord[]): OrderResponse {
    const formattedItems: OrderItemResponse[] = items.map((item) => ({
      id: item.id,
      productDocumentId: item.product_document_id,
      productSlug: item.product_slug,
      productName: item.product_name,
      sku: item.sku,
      productImageUrl: item.product_image_url,
      quantity: item.quantity,
      unitPrice: item.unit_price_paise / 100,
      lineTotal: item.line_total_paise / 100,
      unitPricePaise: item.unit_price_paise,
      lineTotalPaise: item.line_total_paise,
    }));

    return {
      id: order.id,
      orderNumber: order.order_number,
      accessToken: order.access_token,
      status: order.order_status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      deliveryAddress: {
        line1: order.delivery_address_line1,
        line2: order.delivery_address_line2,
        city: order.delivery_city,
        state: order.delivery_state,
        postalCode: order.delivery_postal_code,
        country: order.delivery_country,
      },
      items: formattedItems,
      subtotal: order.subtotal_paise / 100,
      shipping: order.shipping_paise / 100,
      discount: order.discount_paise / 100,
      tax: order.tax_paise / 100,
      grandTotal: order.grand_total_paise / 100,
      subtotalPaise: order.subtotal_paise,
      shippingPaise: order.shipping_paise,
      discountPaise: order.discount_paise,
      taxPaise: order.tax_paise,
      grandTotalPaise: order.grand_total_paise,
      currency: order.currency,
      couponCode: order.coupon_code || null,
      customerNote: order.customer_note,
      createdAt: order.created_at,
    };
  }
}

export const orderService = new OrderService();
