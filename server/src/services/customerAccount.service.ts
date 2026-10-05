import crypto from 'crypto';
import { customerRepository } from '../repositories/customer.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { customerAuthService } from './customerAuth.service.js';
import {
  CustomerDTO,
  CustomerAddressDTO,
  CustomerAddressRecord,
  CreateAddressInput,
  UpdateAddressInput,
  UpdateProfileInput,
  ChangePasswordInput,
  CustomerOrderSummaryDTO,
  CustomerOrderDetailDTO,
  CustomerTimelineStep,
} from '../types/customer.js';
import { OrderRecord } from '../types/order.js';
import { isValidIndianState } from '../utils/indiaStates.js';

export class CustomerAccountService {
  /**
   * Helper to format address record into clean client DTO
   */
  private formatAddressDTO(record: CustomerAddressRecord): CustomerAddressDTO {
    return {
      id: record.id,
      name: record.name,
      phone: record.phone,
      addressLine1: record.address_line_1,
      addressLine2: record.address_line_2,
      city: record.city,
      state: record.state,
      postalCode: record.postal_code,
      country: record.country,
      isDefault: Boolean(record.is_default),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  // ==========================================
  // PROFILE MANAGEMENT
  // ==========================================

  public async getProfile(customerId: string): Promise<CustomerDTO> {
    const customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      throw new Error('Customer account not found.');
    }
    return customerAuthService.formatCustomerDTO(customer);
  }

  public async updateProfile(customerId: string, input: UpdateProfileInput): Promise<CustomerDTO> {
    const customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      throw new Error('Customer account not found.');
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName || trimmedName.length < 2) {
        throw new Error('Please enter a valid name (at least 2 characters).');
      }
    }

    if (input.phone !== undefined && input.phone.trim()) {
      const cleaned = input.phone.replace(/[\s\-\(\)]/g, '');
      const phoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;
      if (!phoneRegex.test(cleaned)) {
        throw new Error('Please enter a valid 10-digit Indian mobile number.');
      }
    }

    const updated = await customerRepository.updateCustomerProfile(
      customerId,
      input.name ?? customer.name,
      input.phone ?? customer.phone
    );

    return customerAuthService.formatCustomerDTO(updated!);
  }

  public async changePassword(customerId: string, input: ChangePasswordInput): Promise<void> {
    const customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      throw new Error('Customer account not found.');
    }

    if (!input.currentPassword || !input.newPassword) {
      throw new Error('Both current password and new password are required.');
    }

    const isMatch = await customerAuthService.verifyPassword(input.currentPassword, customer.password_hash);
    if (!isMatch) {
      throw new Error('The current password entered is incorrect.');
    }

    customerAuthService.validatePasswordStrength(input.newPassword);

    const newHash = await customerAuthService.hashPassword(input.newPassword);
    await customerRepository.updateCustomerPassword(customerId, newHash);
  }

  // ==========================================
  // ADDRESS BOOK MANAGEMENT
  // ==========================================

  public async getAddresses(customerId: string): Promise<CustomerAddressDTO[]> {
    const records = await customerRepository.findAddressesByCustomerId(customerId);
    return records.map((r) => this.formatAddressDTO(r));
  }

  public async createAddress(customerId: string, input: CreateAddressInput): Promise<CustomerAddressDTO> {
    if (!input.name || input.name.trim().length < 2) {
      throw new Error('Recipient name is required.');
    }

    const phoneCleaned = (input.phone || '').replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneCleaned)) {
      throw new Error('A valid 10-digit Indian phone number is required.');
    }

    if (!input.addressLine1 || input.addressLine1.trim().length < 5) {
      throw new Error('Address line 1 must be at least 5 characters.');
    }

    if (!input.city || input.city.trim().length < 2) {
      throw new Error('City is required.');
    }

    if (!input.state || !isValidIndianState(input.state)) {
      throw new Error('Please select a valid Indian State or Union Territory.');
    }

    const postalCleaned = (input.postalCode || '').trim();
    if (!/^[1-9][0-9]{5}$/.test(postalCleaned)) {
      throw new Error('Please enter a valid 6-digit Indian PIN code.');
    }

    // If first address for customer, make it default automatically
    const existingCount = await customerRepository.countAddresses(customerId);
    const isDefaultVal = existingCount === 0 || input.isDefault ? 1 : 0;

    const record = await customerRepository.createAddress({
      id: crypto.randomUUID(),
      customerId,
      name: input.name,
      phone: phoneCleaned,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: postalCleaned,
      country: input.country || 'India',
      isDefault: isDefaultVal,
    });

    return this.formatAddressDTO(record);
  }

  public async updateAddress(
    customerId: string,
    addressId: string,
    input: UpdateAddressInput
  ): Promise<CustomerAddressDTO> {
    const existing = await customerRepository.findAddressByIdAndCustomer(addressId, customerId);
    if (!existing) {
      throw new Error('Address not found or unauthorized.');
    }

    if (input.name !== undefined && input.name.trim().length < 2) {
      throw new Error('Recipient name must be at least 2 characters.');
    }

    if (input.phone !== undefined) {
      const phoneCleaned = input.phone.replace(/[\s\-\(\)]/g, '');
      const phoneRegex = /^(?:\+91|0)?[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneCleaned)) {
        throw new Error('A valid 10-digit Indian phone number is required.');
      }
    }

    if (input.state !== undefined && !isValidIndianState(input.state)) {
      throw new Error('Please select a valid Indian State or Union Territory.');
    }

    if (input.postalCode !== undefined && !/^[1-9][0-9]{5}$/.test(input.postalCode.trim())) {
      throw new Error('Please enter a valid 6-digit Indian PIN code.');
    }

    const updated = await customerRepository.updateAddress({
      ...input,
      id: addressId,
      customerId,
    });
    return this.formatAddressDTO(updated!);
  }

  public async deleteAddress(customerId: string, addressId: string): Promise<void> {
    const success = await customerRepository.deleteAddress(addressId, customerId);
    if (!success) {
      throw new Error('Address not found or unauthorized.');
    }
  }

  // ==========================================
  // CUSTOMER ORDER HISTORY & DETAILS
  // ==========================================

  public async getCustomerOrders(customerId: string, statusFilter?: string): Promise<CustomerOrderSummaryDTO[]> {
    const orders = await orderRepository.findOrdersByCustomerId(customerId, statusFilter);

    return Promise.all(
      orders.map(async (order) => {
        const items = await orderRepository.findOrderItems(order.id);
        const totalItemCount = items.reduce((sum, it) => sum + it.quantity, 0);

        return {
          id: order.id,
          orderNumber: order.order_number,
          createdAt: order.created_at,
          itemsCount: totalItemCount,
          grandTotal: order.grand_total_paise / 100,
          currency: order.currency,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          orderStatus: order.order_status,
        };
      })
    );
  }

  /**
   * Retrieves sanitized customer order details strictly verifying customer ownership
   * Throws 404 if order does not exist OR belongs to another customer
   */
  public async getCustomerOrderDetail(customerId: string, orderIdOrNumber: string): Promise<CustomerOrderDetailDTO> {
    const order = await orderRepository.findCustomerOrderById(orderIdOrNumber, customerId);
    if (!order) {
      // 404: strictly do not reveal whether order exists for someone else
      throw new Error('Order not found.');
    }

    const items = await orderRepository.findOrderItems(order.id);

    // Build customer-friendly artisan journey timeline
    const timeline = this.buildCustomerTimeline(order);

    return {
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      orderStatus: order.order_status,
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
      items: items.map((it) => ({
        id: it.id,
        productSlug: it.product_slug,
        productName: it.product_name,
        sku: it.sku,
        productImageUrl: it.product_image_url,
        quantity: it.quantity,
        unitPrice: it.unit_price_paise / 100,
        lineTotal: it.line_total_paise / 100,
      })),
      subtotal: order.subtotal_paise / 100,
      shipping: order.shipping_paise / 100,
      discount: order.discount_paise / 100,
      grandTotal: order.grand_total_paise / 100,
      currency: order.currency,
      timeline,
    };
  }

  /**
   * Builds an honest, customer-friendly progress timeline based on actual order status
   */
  private buildCustomerTimeline(order: OrderRecord): CustomerTimelineStep[] {
    const status = order.order_status;
    const isPaid = order.payment_status === 'paid' || order.payment_method === 'cod';

    if (status === 'cancelled') {
      return [
        {
          key: 'placed',
          title: 'Order Placed',
          description: 'Your order was received by our atelier.',
          completed: true,
          current: false,
          timestamp: order.created_at,
        },
        {
          key: 'cancelled',
          title: 'Order Cancelled',
          description: 'This order has been cancelled and any reserved items released.',
          completed: true,
          current: true,
          timestamp: order.updated_at,
        },
      ];
    }

    const steps: CustomerTimelineStep[] = [
      {
        key: 'placed',
        title: 'Order Placed',
        description: 'Your bespoke artisan order was received.',
        completed: true,
        current: status === 'pending' && !isPaid,
        timestamp: order.created_at,
      },
      {
        key: 'confirmed',
        title: order.payment_method === 'cod' ? 'Cash On Delivery Verified' : 'Payment Confirmed',
        description:
          order.payment_method === 'cod'
            ? 'Payment will be collected at your doorstep.'
            : isPaid
            ? 'Your payment was securely verified.'
            : 'Awaiting payment confirmation.',
        completed: isPaid,
        current: status === 'pending' && isPaid,
      },
      {
        key: 'processing',
        title: 'Preparing Your Artisan Creation',
        description: 'Our craftsmen are carefully inspecting, polishing, and packaging your pieces.',
        completed: ['confirmed', 'processing', 'shipped', 'delivered'].includes(status),
        current: ['confirmed', 'processing'].includes(status),
      },
      {
        key: 'shipped',
        title: 'Dispatched & In Transit',
        description: 'Handed over to our courier partner in eco-friendly packaging.',
        completed: ['shipped', 'delivered'].includes(status),
        current: status === 'shipped',
      },
      {
        key: 'delivered',
        title: 'Delivered',
        description: 'Arrived at your sanctuary. We hope you cherish your natural creation.',
        completed: status === 'delivered',
        current: status === 'delivered',
      },
    ];

    return steps;
  }
}

export const customerAccountService = new CustomerAccountService();
