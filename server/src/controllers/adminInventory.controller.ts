import { Response, NextFunction } from 'express';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { inventoryService } from '../services/inventory.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class AdminInventoryController {
  /**
   * GET /api/admin/inventory
   * Paginated, searchable, filterable inventory list with live metrics
   */
  public getInventory = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const search = (req.query.search as string) || undefined;
      const statusFilter = (req.query.status as string) || (req.query.statusFilter as string) || 'all';

      const result = await inventoryService.getAdminInventory({
        page,
        limit,
        search,
        statusFilter,
      });

      sendSuccess(res, result, 'Inventory records retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/inventory/:productReference
   * Inspection view of product inventory, audit movements, and active reservations
   */
  public getInventoryDetail = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const productReference = String(req.params.productReference || '').trim();
      const detail = await inventoryService.getAdminProductDetail(productReference);

      if (!detail) {
        sendError(res, `Inventory item "${productReference}" not found`, 404);
        return;
      }

      sendSuccess(res, detail, 'Inventory details loaded');
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/admin/inventory/:productReference/adjust
   * Manual stock adjustment with authenticated admin audit trail
   */
  public adjustStock = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const productReference = String(req.params.productReference || '').trim();
      const { action, quantity, reason } = req.body || {};

      if (!action || !['add', 'remove'].includes(action)) {
        sendError(res, 'Action must be either "add" or "remove"', 400);
        return;
      }

      const numQuantity = Number(quantity);
      if (isNaN(numQuantity) || numQuantity <= 0 || !Number.isInteger(numQuantity)) {
        sendError(res, 'Quantity must be a positive whole integer', 400);
        return;
      }

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        sendError(res, 'A clear reason for the manual stock adjustment is required', 400);
        return;
      }

      // Security: Strictly enforce admin ID from authenticated session, never request body
      const adminUserId = req.admin!.id;

      const updated = await inventoryService.manualAdjustStock(
        productReference,
        {
          action,
          quantity: numQuantity,
          reason: reason.trim(),
        },
        adminUserId
      );

      sendSuccess(res, updated, `Successfully adjusted stock (${action} ${numQuantity} units)`);
    } catch (error: any) {
      if (error.message?.includes('Cannot remove')) {
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
   * GET /api/admin/inventory/movements
   * Audit timeline of all stock movements
   */
  public getMovements = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const productReference = (req.query.productReference as string) || undefined;

      const result = await inventoryService.getAdminMovements({
        page,
        limit,
        productReference,
      });

      sendSuccess(res, result, 'Stock movements retrieved');
    } catch (error) {
      next(error);
    }
  };
}

export const adminInventoryController = new AdminInventoryController();
