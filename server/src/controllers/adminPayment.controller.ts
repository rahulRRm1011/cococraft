import { Response, NextFunction } from 'express';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

function formatPaymentRecord(p: any) {
  return {
    id: p.id,
    orderId: p.order_id,
    orderNumber: p.order_number,
    customerName: p.customer_name,
    customerEmail: p.customer_email,
    paymentReference: p.payment_reference,
    provider: p.provider,
    method: p.method,
    amount: (p.amount_paise || 0) / 100,
    amountPaise: p.amount_paise,
    currency: p.currency,
    status: p.status,
    attemptNumber: p.attempt_number,
    providerReference: p.provider_reference,
    failureCode: p.failure_code,
    failureMessage: p.failure_message,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    completedAt: p.completed_at,
  };
}

export class AdminPaymentController {
  /**
   * GET /api/admin/payments
   * Paginated, searchable payment attempts monitor
   */
  public getPayments = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = (req.query.search as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const method = (req.query.method as string) || undefined;
      const dateRange = (req.query.dateRange as any) || 'all';

      const result = await paymentRepository.findPaymentsPaginated({
        page,
        limit,
        search,
        status,
        method,
        dateRange,
      });

      sendSuccess(
        res,
        {
          ...result,
          items: result.items.map(formatPaymentRecord),
        },
        'Payments list retrieved'
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/payments/:paymentId
   * Detailed payment attempt inspection
   */
  public getPaymentDetail = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const paymentId = String(req.params.paymentId);
      const payment = await paymentRepository.findPaymentById(paymentId);
      if (!payment) {
        sendError(res, 'Payment record not found', 404);
        return;
      }

      sendSuccess(res, formatPaymentRecord(payment), 'Payment details loaded');
    } catch (error) {
      next(error);
    }
  };
}

export const adminPaymentController = new AdminPaymentController();
