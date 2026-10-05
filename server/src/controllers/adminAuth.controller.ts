import { Request, Response, NextFunction } from 'express';
import { adminAuthService } from '../services/adminAuth.service.js';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class AdminAuthController {
  /**
   * POST /api/admin/auth/login
   * Authenticates admin staff and sets HttpOnly admin session cookie
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      const { token, user } = await adminAuthService.login(email, password, clientIp);

      // Set dedicated HttpOnly admin session cookie
      res.cookie('cococraft_admin_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
        path: '/',
      });

      sendSuccess(res, { user, token }, 'Admin sign-in successful');
    } catch (error: any) {
      if (
        error.message?.includes('credentials') ||
        error.message?.includes('required') ||
        error.message?.includes('Too many failed')
      ) {
        sendError(res, error.message, 401);
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/admin/auth/logout
   * Invalidates server-side session and clears cookie
   */
  public logout = async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token = req.cookies?.cococraft_admin_session;
      if (!token && req.headers.cookie) {
        const match = req.headers.cookie
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('cococraft_admin_session='));
        if (match) {
          token = decodeURIComponent(match.substring('cococraft_admin_session='.length));
        }
      }
      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7).trim();
      }

      if (token) {
        adminAuthService.logout(token);
      }

      res.clearCookie('cococraft_admin_session', { path: '/' });
      sendSuccess(res, { loggedOut: true }, 'Admin signed out successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/auth/me
   * Returns current authenticated admin profile
   */
  public getMe = async (req: AuthenticatedAdminRequest, res: Response): Promise<void> => {
    if (!req.admin) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    sendSuccess(res, req.admin, 'Admin profile retrieved');
  };
}

export const adminAuthController = new AdminAuthController();
