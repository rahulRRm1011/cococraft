export interface OrderRecord {
  id: string;
  order_number: string;
  access_token: string;
  cart_id: string | null;
  idempotency_key: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address_line1: string;
  delivery_address_line2: string | null;
  delivery_city: string;
  delivery_state: string;
  delivery_postal_code: string;
  delivery_country: string;
  subtotal_paise: number;
  shipping_paise: number;
  discount_paise: number;
  tax_paise: number;
  grand_total_paise: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  customer_note: string | null;
  customer_id?: string | null;
  coupon_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRecord {
  id: number;
  order_id: string;
  product_document_id: string;
  product_slug: string;
  product_name: string;
  sku: string;
  product_image_url: string | null;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
  created_at: string;
}

export interface CustomerInput {
  name: string;
  email: string;
  phone: string;
}

export interface DeliveryAddressInput {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface CreateOrderInput {
  cartId: string;
  customer: CustomerInput;
  deliveryAddress: DeliveryAddressInput;
  customerNote?: string;
  idempotencyKey?: string;
  paymentMethod?: 'cod' | 'online';
  customerId?: string | null;
  couponCode?: string | null;
}

export interface OrderItemResponse {
  id: number;
  productDocumentId: string;
  productSlug: string;
  productName: string;
  sku: string;
  productImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  accessToken: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryAddress: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: OrderItemResponse[];
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  grandTotal: number;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  taxPaise: number;
  grandTotalPaise: number;
  currency: string;
  couponCode?: string | null;
  customerNote?: string | null;
  createdAt: string;
}

export interface ShippingConfigResponse {
  freeShippingThreshold: number;
  standardShippingFee: number;
  freeShippingThresholdPaise: number;
  standardShippingPaise: number;
}
