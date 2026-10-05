import { Request, Response, NextFunction } from 'express';
import { adminAuthService } from '../services/adminAuth.service.js';
import { sendError } from '../utils/apiResponse.js';
import { AdminUser } from '../types/admin.js';

export interface AuthenticatedAdminRequest extends Request {
  admin?: AdminUser;
}

function getCookie(req: Request, name: string): string | undefined {
  if (req.cookies && req.cookies[name]) {
    return req.cookies[name];
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.substring(name.length + 1));
}

/**
 * Protects private admin APIs. Enforces server-side session authentication.
 */
export async function requireAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Basic CSRF Origin check for state-changing operations
  const mutationMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (mutationMethods.includes(req.method)) {
    const origin = (req.headers.origin || req.headers.referer) as string | undefined;
    if (origin) {
      const host = req.headers.host;
      let isAllowed = false;

      // Allow same-origin
      if (host && (origin.includes(`://${host}`) || origin.includes(`//${host.split(':')[0]}`))) {
        isAllowed = true;
      }

      // Allow local development
      if (!isAllowed) {
        const allowedDevOrigins = [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:4000',
          'http://127.0.0.1:4000',
        ];
        isAllowed = allowedDevOrigins.some((allowed) => origin.startsWith(allowed));
      }

      // Allow Vercel preview / production domains
      if (!isAllowed) {
        try {
          const originUrl = new URL(origin);
          if (
            originUrl.hostname === 'cococraft.vercel.app' ||
            originUrl.hostname.endsWith('.vercel.app')
          ) {
            isAllowed = true;
          }
        } catch {
          // invalid url
        }
      }

      if (!isAllowed && process.env.NODE_ENV === 'production') {
        sendError(res, 'Cross-Site Request Forgery validation failed.', 403);
        return;
      }
    }
  }

  // 2. Extract admin session token from cookie or Authorization header
  let token = getCookie(req, 'cococraft_admin_session');

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }

  if (!token) {
    sendError(res, 'Authentication required. No active admin session found.', 401);
    return;
  }

  // 3. Authorize via server-side session validation
  const adminUser = await adminAuthService.validateToken(token);
  if (!adminUser) {
    // Clear stale cookie
    res.clearCookie('cococraft_admin_session', { path: '/' });
    sendError(res, 'Admin session expired or invalid. Please sign in again.', 401);
    return;
  }

  // 4. Attach authenticated admin to request object
  req.admin = adminUser;
  next();
}
