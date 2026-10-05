import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { extractCustomerToken } from '../middleware/requireCustomerAuth.js';
import { customerAuthService } from '../services/customerAuth.service.js';

function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.substring(name.length + 1));
}

export class OrderController {
  /**
   * POST /api/orders
   * Creates an order from a hamper session (supports guest and authenticated customers)
   */
  public createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;

      let authenticatedCustomerId: string | undefined;
      const customerToken = extractCustomerToken(req);
      if (customerToken) {
        const customer = await customerAuthService.validateToken(customerToken);
        if (customer) {
          authenticatedCustomerId = customer.id;
        }
      }

      const order = await orderService.createOrder(req.body, idempotencyKey, authenticatedCustomerId);

      // Issue HttpOnly guest session cookie for secure URL-free confirmation access
      res.cookie('cococraft_order_session', order.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 48 * 60 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, order, 'Order successfully placed', 201);
    } catch (error: any) {
      if (
        error.message?.includes('required') ||
        error.message?.includes('valid') ||
        error.message?.includes('empty') ||
        error.message?.includes('not found') ||
        error.message?.includes('stock') ||
        error.message?.includes('no longer') ||
        error.message?.includes('India') ||
        error.message?.includes('exceed') ||
        error.message?.includes('coupon') ||
        error.message?.includes('discount') ||
        error.message?.includes('expired')
      ) {
        sendError(res, error.message, 400);
        return;
      }
      next(error);
    }
  };

  /**
   * GET /api/orders/:orderId/confirmation
   * Retrieves order confirmation securely via HttpOnly session cookie, header, or query token
   */
  public getOrderConfirmation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.orderId);
      const token = req.query.token ? String(req.query.token) : (req.headers['x-order-session'] as string);
      const sessionCookie = getCookie(req, 'cococraft_order_session');

      if (!token && !sessionCookie) {
        sendError(res, 'Secure session or access token is required to view order confirmation.', 401);
        return;
      }

      const order = await orderService.getOrderConfirmation(orderId, token, sessionCookie);

      // Refresh cookie
      res.cookie('cococraft_order_session', order.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 48 * 60 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, order, 'Order confirmation loaded');
    } catch (error: any) {
      if (error.statusCode === 403 || error.message?.includes('access token') || error.message?.includes('session')) {
        sendError(res, error.message || 'Access denied', 403);
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
   * GET /api/orders/config/shipping
   * Returns current server shipping thresholds
   */
  public getShippingConfig = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const configData = orderService.getShippingConfig();
      sendSuccess(res, configData, 'Shipping configuration retrieved');
    } catch (error) {
      next(error);
    }
  };
}

export const orderController = new OrderController();
