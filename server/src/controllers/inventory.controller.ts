import { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services/inventory.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class InventoryController {
  /**
   * GET /api/inventory/product/:reference
   * Returns storefront availability for a single product reference (documentId, SKU, or slug)
   */
  public getProductAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const reference = String(req.params.reference || '').trim();
      if (!reference) {
        sendError(res, 'Product reference is required', 400);
        return;
      }

      const availability = await inventoryService.getProductAvailability(reference);
      if (!availability) {
        sendError(res, `Inventory record not found for "${reference}"`, 404);
        return;
      }

      sendSuccess(res, availability, 'Product availability loaded');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/inventory/availability
   * Batch availability for product catalog and hamper listings
   */
  public getBatchAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const referencesQuery = req.query.references as string | undefined;
      const references = referencesQuery
        ? referencesQuery.split(',').map((r) => r.trim()).filter(Boolean)
        : undefined;

      const availabilityMap = await inventoryService.getBatchAvailability(references);
      sendSuccess(res, availabilityMap, 'Batch availability loaded');
    } catch (error) {
      next(error);
    }
  };
}

export const inventoryController = new InventoryController();
