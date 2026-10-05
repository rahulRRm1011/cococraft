import { Response, NextFunction } from 'express';
import { customerAuthService } from '../services/customerAuth.service.js';
import { AuthenticatedCustomerRequest, extractCustomerToken } from '../middleware/requireCustomerAuth.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class CustomerAuthController {
  private readonly COOKIE_NAME = 'cococraft_customer_session';
  private readonly COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(this.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: this.COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }

  /**
   * POST /api/customer/auth/register
   */
  public register = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name, email, password, phone } = req.body || {};
      const result = await customerAuthService.register({ name, email, password, phone });

      this.setSessionCookie(res, result.token);

      sendSuccess(res, { customer: result.customer }, 'Welcome to CocoCraft Atelier. Account created successfully.', 201);
    } catch (err: any) {
      if (
        err.message?.includes('valid') ||
        err.message?.includes('exists') ||
        err.message?.includes('Password') ||
        err.message?.includes('provide')
      ) {
        sendError(res, err.message, 400);
        return;
      }
      next(err);
    }
  };

  /**
   * POST /api/customer/auth/login
   */
  public login = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body || {};
      const result = await customerAuthService.login({ email, password });

      this.setSessionCookie(res, result.token);

      sendSuccess(res, { customer: result.customer }, 'Signed in successfully.');
    } catch (err: any) {
      if (err.message === 'Invalid email or password.') {
        sendError(res, 'Invalid email or password.', 401);
        return;
      }
      next(err);
    }
  };

  /**
   * POST /api/customer/auth/logout
   */
  public logout = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = extractCustomerToken(req);
      if (token) {
        customerAuthService.logout(token);
      }

      res.clearCookie(this.COOKIE_NAME, { path: '/' });
      sendSuccess(res, null, 'Signed out successfully.');
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/customer/auth/me
   */
  public getMe = async (
    req: AuthenticatedCustomerRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.customer) {
        sendError(res, 'Not authenticated', 401);
        return;
      }

      const customerDto = customerAuthService.formatCustomerDTO(req.customer);
      sendSuccess(res, { customer: customerDto });
    } catch (err) {
      next(err);
    }
  };
}

export const customerAuthController = new CustomerAuthController();
