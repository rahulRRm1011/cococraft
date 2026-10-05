import { Request, Response, NextFunction } from 'express';
import { customerAuthService } from '../services/customerAuth.service.js';
import { sendError } from '../utils/apiResponse.js';
import { CustomerRecord } from '../types/customer.js';

export interface AuthenticatedCustomerRequest extends Request {
  customer?: CustomerRecord;
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
 * Extracts customer session token from dedicated cookie or Authorization header
 */
export function extractCustomerToken(req: Request): string | undefined {
  let token = getCookie(req, 'cococraft_customer_session');
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }
  return token;
}

/**
 * Middleware: Enforces customer session authentication for private customer APIs.
 * Never trust customer_id from request body/params; authenticated session is security authority.
 */
export async function requireCustomerAuth(
  req: AuthenticatedCustomerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractCustomerToken(req);

  if (!token) {
    sendError(res, 'Authentication required. Please sign in to access your account.', 401);
    return;
  }

  const customer = await customerAuthService.validateToken(token);
  if (!customer) {
    // Clear expired or invalid session cookie
    res.clearCookie('cococraft_customer_session', { path: '/' });
    sendError(res, 'Session expired or invalid. Please sign in again.', 401);
    return;
  }

  req.customer = customer;
  next();
}

/**
 * Middleware: Optionally extracts and attaches authenticated customer if session exists
 * Used for endpoints like POST /api/orders where guests and registered customers share the route
 */
export async function optionalCustomerAuth(
  req: AuthenticatedCustomerRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractCustomerToken(req);
  if (token) {
    const customer = await customerAuthService.validateToken(token);
    if (customer) {
      req.customer = customer;
    }
  }
  next();
}
