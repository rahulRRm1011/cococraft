import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/health.service.js';

export class HealthController {
  public getHealth = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const healthData = healthService.getHealthStatus();
      res.status(200).json(healthData);
    } catch (error) {
      next(error);
    }
  };
}

export const healthController = new HealthController();
