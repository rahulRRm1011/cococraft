import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service.js';
import { orderRepository } from '../repositories/order.repository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class PaymentController {
  /**
   * POST /api/payments
   * Initiates a new payment attempt for an order
   */
  public initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
      const payment = await paymentService.initiatePayment(req.body, idempotencyKey);
      sendSuccess(res, payment, 'Payment attempt created', 201);
    } catch (error: any) {
      if (
        error.message?.includes('required') ||
        error.message?.includes('Invalid') ||
        error.message?.includes('already been paid') ||
        error.message?.includes('cancelled')
      ) {
        sendError(res, error.message, 400);
        return;
      }
      if (error.message?.includes('Order not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/payments/:paymentId/process
   * Processes a simulated payment action (success, failure, cancel, or pending)
   */
  public processPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentId = String(req.params.paymentId);
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
      const payment = await paymentService.processPayment(paymentId, req.body, idempotencyKey);

      // On successful payment, issue the HttpOnly guest order session cookie
      if (payment.status === 'paid') {
        const order = await orderRepository.findOrderById(payment.orderId);
        if (order) {
          res.cookie('cococraft_order_session', order.access_token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 48 * 60 * 60 * 1000,
            path: '/',
          });
        }
      }

      sendSuccess(res, payment, `Payment processed (${payment.status})`);
    } catch (error: any) {
      if (
        error.message?.includes('already been paid') ||
        error.message?.includes('Cannot process') ||
        error.message?.includes('Invalid')
      ) {
        sendError(res, error.message, 400);
        return;
      }
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  /**
   * GET /api/payments/:paymentId
   * Retrieves payment status and associated order summary
   */
  public getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentId = String(req.params.paymentId);
      const payment = await paymentService.getPayment(paymentId);
      sendSuccess(res, payment, 'Payment loaded');
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/payments/:paymentId/verify
   * Verifies/reconciles a pending payment attempt
   */
  public verifyPendingPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentId = String(req.params.paymentId);
      const payment = await paymentService.verifyPendingPayment(paymentId);

      if (payment.status === 'paid') {
        const order = await orderRepository.findOrderById(payment.orderId);
        if (order) {
          res.cookie('cococraft_order_session', order.access_token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 48 * 60 * 60 * 1000,
            path: '/',
          });
        }
      }

      sendSuccess(res, payment, `Payment status verified (${payment.status})`);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  /**
   * GET /api/orders/:orderId/payments
   * Retrieves full payment attempt history for an order
   */
  public getOrderPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.orderId);
      const history = await paymentService.getPaymentHistory(orderId);
      sendSuccess(res, history, 'Order payments retrieved');
    } catch (error) {
      next(error);
    }
  };
}

export const paymentController = new PaymentController();
