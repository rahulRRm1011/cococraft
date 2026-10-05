import { Response, NextFunction } from 'express';
import { adminAnalyticsService } from '../services/adminAnalytics.service.js';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class AdminAnalyticsController {
  /**
   * GET /api/admin/analytics
   * Optional query param: period ('today' | '7d' | '30d' | 'all')
   */
  public getAnalytics = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const period = String(req.query.period || '30d');
      const data = await adminAnalyticsService.getAnalytics(period);
      sendSuccess(res, data, 'Analytics data retrieved');
    } catch (error) {
      next(error);
    }
  };
}

export const adminAnalyticsController = new AdminAnalyticsController();
