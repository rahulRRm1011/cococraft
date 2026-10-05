import { Response, NextFunction } from 'express';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { adminOrderService } from '../services/adminOrder.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class AdminOrderController {
  /**
   * GET /api/admin/orders
   * Paginated, searchable, filterable order listing
   */
  public getOrders = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = (req.query.search as string) || undefined;
      const orderStatus = (req.query.orderStatus as string) || undefined;
      const paymentStatus = (req.query.paymentStatus as string) || undefined;
      const paymentMethod = (req.query.paymentMethod as string) || undefined;
      const sortBy = (req.query.sortBy as any) || 'created_at';
      const sortDir = (req.query.sortDir as any) || 'desc';
      const dateRange = (req.query.dateRange as any) || 'all';

      const result = adminOrderService.getOrders({
        page,
        limit,
        search,
        orderStatus,
        paymentStatus,
        paymentMethod,
        sortBy,
        sortDir,
        dateRange,
      });

      sendSuccess(res, result, 'Orders list retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/orders/:orderId
   * Detailed order inspection with items, payment attempts, and timeline
   */
  public getOrderDetail = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const orderId = String(req.params.orderId);
      const detail = adminOrderService.getOrderDetail(orderId);
      sendSuccess(res, detail, 'Order details loaded');
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  /**
   * PATCH /api/admin/orders/:orderId/status
   * Controlled operational status update
   */
  public updateStatus = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const orderId = String(req.params.orderId);
      const { status, note } = req.body;

      if (!status) {
        sendError(res, 'New status is required.', 400);
        return;
      }

      if (!req.admin) {
        sendError(res, 'Admin authentication required.', 401);
        return;
      }

      const updatedOrder = adminOrderService.updateOrderStatus(
        orderId,
        status,
        req.admin.id,
        note
      );

      sendSuccess(res, updatedOrder, `Order status updated to ${status}`);
    } catch (error: any) {
      if (
        error.message?.includes('Invalid status transition') ||
        error.message?.includes('cannot be confirmed') ||
        error.message?.includes('Terminal state')
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
}

export const adminOrderController = new AdminOrderController();
