import { Response, NextFunction } from 'express';
import { customerAccountService } from '../services/customerAccount.service.js';
import { AuthenticatedCustomerRequest } from '../middleware/requireCustomerAuth.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class CustomerAccountController {
  // ==========================================
  // PROFILE
  // ==========================================

  public getProfile = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const profile = await customerAccountService.getProfile(customer.id);
      sendSuccess(res, profile);
    } catch (err) {
      next(err);
    }
  };

  public updateProfile = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const { name, phone } = req.body || {};
      const updated = await customerAccountService.updateProfile(customer.id, { name, phone });
      sendSuccess(res, updated, 'Profile updated successfully.');
    } catch (err: any) {
      if (err.message?.includes('valid') || err.message?.includes('characters')) {
        sendError(res, err.message, 400);
        return;
      }
      next(err);
    }
  };

  public changePassword = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const { currentPassword, newPassword } = req.body || {};
      await customerAccountService.changePassword(customer.id, { currentPassword, newPassword });
      sendSuccess(res, null, 'Password updated successfully.');
    } catch (err: any) {
      if (err.message?.includes('incorrect') || err.message?.includes('Password') || err.message?.includes('required')) {
        sendError(res, err.message, 400);
        return;
      }
      next(err);
    }
  };

  // ==========================================
  // ADDRESSES
  // ==========================================

  public getAddresses = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const addresses = await customerAccountService.getAddresses(customer.id);
      sendSuccess(res, addresses);
    } catch (err) {
      next(err);
    }
  };

  public createAddress = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const address = await customerAccountService.createAddress(customer.id, req.body);
      sendSuccess(res, address, 'Address added to your address book.', 201);
    } catch (err: any) {
      if (err.message?.includes('required') || err.message?.includes('valid') || err.message?.includes('PIN')) {
        sendError(res, err.message, 400);
        return;
      }
      next(err);
    }
  };

  public updateAddress = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const addressId = String(req.params.id);
      const updated = await customerAccountService.updateAddress(customer.id, addressId, req.body);
      sendSuccess(res, updated, 'Address updated successfully.');
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('unauthorized')) {
        sendError(res, 'Address not found or unauthorized.', 404);
        return;
      }
      if (err.message?.includes('valid') || err.message?.includes('characters') || err.message?.includes('PIN')) {
        sendError(res, err.message, 400);
        return;
      }
      next(err);
    }
  };

  public deleteAddress = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const addressId = String(req.params.id);
      await customerAccountService.deleteAddress(customer.id, addressId);
      sendSuccess(res, null, 'Address removed successfully.');
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('unauthorized')) {
        sendError(res, 'Address not found or unauthorized.', 404);
        return;
      }
      next(err);
    }
  };

  // ==========================================
  // ORDERS
  // ==========================================

  public getOrders = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const statusFilter = (req.query.status as string) || undefined;
      const orders = await customerAccountService.getCustomerOrders(customer.id, statusFilter);
      sendSuccess(res, orders);
    } catch (err) {
      next(err);
    }
  };

  public getOrderDetail = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customer = req.customer!;
      const orderId = String(req.params.orderId);
      const order = await customerAccountService.getCustomerOrderDetail(customer.id, orderId);
      sendSuccess(res, order);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        // Strictly return 404 to avoid leaking existence of any order
        sendError(res, 'Order not found.', 404);
        return;
      }
      next(err);
    }
  };
}

export const customerAccountController = new CustomerAccountController();
