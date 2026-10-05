import crypto from 'crypto';
import { PaymentRecord, PaymentMethod, ProcessPaymentInput } from '../types/payment.js';
import { OrderRecord } from '../types/order.js';

export interface ProviderProcessResult {
  status: 'paid' | 'failed' | 'cancelled' | 'pending';
  providerReference: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface PaymentProvider {
  readonly providerName: string;
  initiate(order: OrderRecord, method: PaymentMethod): Promise<{ providerReference: string }>;
  process(payment: PaymentRecord, input: ProcessPaymentInput): Promise<ProviderProcessResult>;
  verify(payment: PaymentRecord): Promise<ProviderProcessResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  public readonly providerName = 'cococraft_mock';

  /**
   * Initiates payment on the mock provider
   */
  public async initiate(order: OrderRecord, method: PaymentMethod): Promise<{ providerReference: string }> {
    const providerReference = `MOCK_TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    return { providerReference };
  }

  /**
   * Processes a simulated payment based on customer demo inputs or selected scenario
   */
  public async process(payment: PaymentRecord, input: ProcessPaymentInput): Promise<ProviderProcessResult> {
    const txnRef = `MOCK_TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 1. Explicit scenario override
    if (input.scenario === 'cancel') {
      return {
        status: 'cancelled',
        providerReference: txnRef,
        failureCode: 'DEMO_CANCELLED',
        failureMessage: 'The demo payment was cancelled by the customer.',
      };
    }

    if (input.scenario === 'failure') {
      return {
        status: 'failed',
        providerReference: txnRef,
        failureCode: 'DEMO_DECLINED',
        failureMessage: 'Simulated bank decline: Transaction was declined by the issuer.',
      };
    }

    if (input.scenario === 'pending') {
      return {
        status: 'pending',
        providerReference: `MOCK_PEND_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        failureMessage: 'Transaction is awaiting simulated asynchronous bank clearance.',
      };
    }

    if (input.scenario === 'success') {
      return {
        status: 'paid',
        providerReference: txnRef,
      };
    }

    // 2. Realistic credential-based simulation
    const method = input.method || payment.method;

    if (method === 'upi') {
      const upiId = (input.demoUpiId || '').trim().toLowerCase();

      if (upiId.includes('fail') || upiId === 'fail@cococraft') {
        return {
          status: 'failed',
          providerReference: txnRef,
          failureCode: 'DEMO_UPI_DECLINED',
          failureMessage: 'Simulated UPI app decline: Customer rejected payment request.',
        };
      }

      if (upiId.includes('pending') || upiId === 'pending@cococraft') {
        return {
          status: 'pending',
          providerReference: `MOCK_PEND_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          failureMessage: 'UPI collect request sent to customer app; awaiting authorization.',
        };
      }

      // Default demo UPI success (e.g. demo@cococraft, demo.success@cococraft, etc.)
      return {
        status: 'paid',
        providerReference: txnRef,
      };
    }

    if (method === 'card') {
      const cardDigits = (input.demoCardNumber || '').replace(/\D/g, '');

      // Demo decline card: ends in 0002
      if (cardDigits.endsWith('0002')) {
        return {
          status: 'failed',
          providerReference: txnRef,
          failureCode: 'DEMO_CARD_DECLINED',
          failureMessage: 'Simulated card decline: Insufficient balance or card blocked by issuer.',
        };
      }

      // Demo success card: 4111 1111 1111 1111 or ending in 1111
      if (cardDigits.endsWith('1111') || cardDigits.length === 0) {
        return {
          status: 'paid',
          providerReference: txnRef,
        };
      }

      // Other cards are rejected with clear demo guidance
      return {
        status: 'failed',
        providerReference: txnRef,
        failureCode: 'DEMO_CARD_INVALID',
        failureMessage: 'Please use the provided CocoCraft demo card credentials to test this simulator.',
      };
    }

    if (method === 'netbanking') {
      // Demo net banking approval
      return {
        status: 'paid',
        providerReference: txnRef,
      };
    }

    // Fallback: Success for simulator
    return {
      status: 'paid',
      providerReference: txnRef,
    };
  }

  /**
   * Verifies existing payment status with the mock provider (used for pending recovery / reconciliations)
   */
  public async verify(payment: PaymentRecord): Promise<ProviderProcessResult> {
    if (payment.status === 'paid') {
      return {
        status: 'paid',
        providerReference: payment.provider_reference || `MOCK_VERIFIED_${payment.id}`,
      };
    }

    if (payment.status === 'pending') {
      // Transition pending to paid upon explicit check
      return {
        status: 'paid',
        providerReference: `MOCK_TXN_CLEARED_${Date.now()}`,
      };
    }

    return {
      status: payment.status as any,
      providerReference: payment.provider_reference || `MOCK_REF_${payment.id}`,
      failureCode: payment.failure_code || undefined,
      failureMessage: payment.failure_message || undefined,
    };
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
