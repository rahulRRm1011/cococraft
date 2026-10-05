export interface CustomerRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CustomerSessionRecord {
  id: string;
  customer_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

export interface CustomerAddressRecord {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: number; // 0 or 1 in SQLite
  created_at: string;
  updated_at: string;
}

export interface CustomerDTO {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CustomerAddressDTO {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterCustomerInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginCustomerInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface CreateAddressInput {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export interface CustomerTimelineStep {
  key: 'placed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
  timestamp?: string;
}

export interface CustomerOrderItemDTO {
  id: number;
  productSlug: string;
  productName: string;
  sku: string;
  productImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerOrderSummaryDTO {
  id: string;
  orderNumber: string;
  createdAt: string;
  itemsCount: number;
  grandTotal: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  orderStatus: string;
}

export interface CustomerOrderDetailDTO {
  id: string;
  orderNumber: string;
  createdAt: string;
  orderStatus: string;
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
  items: CustomerOrderItemDTO[];
  subtotal: number;
  shipping: number;
  discount: number;
  grandTotal: number;
  currency: string;
  timeline: CustomerTimelineStep[];
}
