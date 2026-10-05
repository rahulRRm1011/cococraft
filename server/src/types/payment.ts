export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface PaymentRecord {
  id: string;
  order_id: string;
  payment_reference: string;
  provider: string;
  method: PaymentMethod;
  amount_paise: number;
  currency: string;
  status: PaymentStatus;
  attempt_number: number;
  idempotency_key: string | null;
  provider_reference: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface InitiatePaymentInput {
  orderId: string;
  method: PaymentMethod;
  idempotencyKey?: string;
}

export interface ProcessPaymentInput {
  scenario?: 'success' | 'failure' | 'pending' | 'cancel';
  method?: PaymentMethod;
  // Demo simulation inputs (NEVER real credentials)
  demoUpiId?: string;
  demoCardNumber?: string;
  demoBankCode?: string;
}

export interface PaymentOrderSummary {
  id: string;
  orderNumber: string;
  grandTotal: number;
  grandTotalPaise: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemsCount: number;
}

export interface PaymentResponse {
  id: string;
  orderId: string;
  paymentReference: string;
  provider: string;
  method: PaymentMethod;
  amount: number;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  attemptNumber: number;
  providerReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  order?: PaymentOrderSummary;
}
