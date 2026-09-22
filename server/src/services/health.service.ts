import { HealthResponse } from '../types/api.js';

export class HealthService {
  public getHealthStatus(): HealthResponse {
    return {
      success: true,
      service: 'CocoCraft API'
    };
  }
}

export const healthService = new HealthService();
