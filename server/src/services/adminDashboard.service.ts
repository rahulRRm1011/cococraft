import { orderRepository } from '../repositories/order.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { DashboardMetrics } from '../types/admin.js';

export class AdminDashboardService {
  /**
   * Aggregates comprehensive operational metrics for the Admin Dashboard
   */
  public async getMetrics(dateRange = '30d'): Promise<DashboardMetrics> {
    const validRange = ['today', '7d', '30d', 'all'].includes(dateRange) ? dateRange : '30d';

    const [
      summary,
      orderTrend,
      paymentMethodDistribution,
      orderStatusDistribution,
      recentOrders,
      recentPayments,
    ] = await Promise.all([
      orderRepository.getDashboardSummary(validRange),
      orderRepository.getOrderTrend(validRange),
      orderRepository.getPaymentMethodDistribution(validRange),
      orderRepository.getOrderStatusDistribution(validRange),
      orderRepository.getRecentOrders(6),
      paymentRepository.getRecentPayments(6),
    ]);

    return {
      summary,
      orderTrend,
      paymentMethodDistribution,
      orderStatusDistribution,
      recentOrders,
      recentPayments,
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
