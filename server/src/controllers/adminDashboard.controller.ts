import { Response, NextFunction } from 'express';
import { AuthenticatedAdminRequest } from '../middleware/requireAdmin.js';
import { adminDashboardService } from '../services/adminDashboard.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class AdminDashboardController {
  /**
   * GET /api/admin/dashboard
   * Returns aggregated operational dashboard metrics
   */
  public getDashboard = async (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const range = (req.query.range as string) || '30d';
      const metrics = adminDashboardService.getMetrics(range);
      sendSuccess(res, metrics, 'Dashboard operational metrics loaded');
    } catch (error) {
      next(error);
    }
  };
}

export const adminDashboardController = new AdminDashboardController();
