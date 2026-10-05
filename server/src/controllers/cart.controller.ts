import { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class CartController {
  /**
   * POST /api/cart
   * Creates or resolves a guest cart
   */
  public getOrCreateCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cartId = req.body?.cartId ? String(req.body.cartId) : undefined;
      const cart = await cartService.getOrCreateCart(cartId);
      sendSuccess(res, cart, 'Guest cart resolved', 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/cart/:cartId
   * Retrieves full cart state
   */
  public getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cartId = String(req.params.cartId);
      const cart = await cartService.getCart(cartId);
      sendSuccess(res, cart);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        sendError(res, error.message, 404);
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/cart/:cartId/items
   * Adds an item to the guest cart
   */
  public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cartId = String(req.params.cartId);
      const { productSlug, productDocumentId, quantity } = req.body;

      if (!productSlug && !productDocumentId) {
        sendError(res, 'Either productSlug or productDocumentId is required.', 400);
        return;
      }

      if (quantity === undefined || quantity === null) {
        sendError(res, 'Quantity is required.', 400);
        return;
      }

      const cart = await cartService.addItem(cartId, {
        productSlug: productSlug ? String(productSlug) : undefined,
        productDocumentId: productDocumentId ? String(productDocumentId) : undefined,
        quantity,
      });

      sendSuccess(res, cart, 'Item added to hamper', 200);
    } catch (error: any) {
      sendError(res, error.message || 'Unable to add item to hamper', 400);
    }
  };

  /**
   * PATCH /api/cart/:cartId/items/:itemId
   * Updates an item's quantity
   */
  public updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cartId = String(req.params.cartId);
      const itemId = parseInt(String(req.params.itemId), 10);
      const { quantity } = req.body;

      if (isNaN(itemId)) {
        sendError(res, 'Invalid cart item ID.', 400);
        return;
      }

      if (quantity === undefined || quantity === null) {
        sendError(res, 'Quantity is required.', 400);
        return;
      }

      const cart = await cartService.updateItemQuantity(cartId, itemId, quantity);
      sendSuccess(res, cart, 'Hamper item updated', 200);
    } catch (error: any) {
      sendError(res, error.message || 'Unable to update item quantity', 400);
    }
  };

  /**
   * DELETE /api/cart/:cartId/items/:itemId
   * Removes an item from the cart
   */
  public removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cartId = String(req.params.cartId);
      const itemId = parseInt(String(req.params.itemId), 10);

      if (isNaN(itemId)) {
        sendError(res, 'Invalid cart item ID.', 400);
        return;
      }

      const cart = await cartService.removeItem(cartId, itemId);
      sendSuccess(res, cart, 'Item removed from hamper', 200);
    } catch (error: any) {
      sendError(res, error.message || 'Unable to remove item from hamper', 400);
    }
  };

  /**
   * DELETE /api/cart/:cartId
   * Clears all items in the cart
   */
  public clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cartId = String(req.params.cartId);
      const cart = await cartService.clearCart(cartId);
      sendSuccess(res, cart, 'Hamper cleared', 200);
    } catch (error: any) {
      sendError(res, error.message || 'Unable to clear hamper', 400);
    }
  };
}

export const cartController = new CartController();
