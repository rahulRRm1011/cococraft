import { analyticsRepository } from '../repositories/analytics.repository.js';
import { catalogService } from './catalog.service.js';
import {
  ComprehensiveAnalyticsResult,
  CategoryPerformanceMetric,
} from '../types/analytics.js';

export class AdminAnalyticsService {
  /**
   * Retrieves comprehensive business intelligence and analytics
   */
  public async getAnalytics(rawPeriod = '30d'): Promise<ComprehensiveAnalyticsResult> {
    const period = (['today', '7d', '30d', 'all'].includes(rawPeriod) ? rawPeriod : '30d') as
      | 'today'
      | '7d'
      | '30d'
      | 'all';

    const [overview, customerMetrics, salesTrend, productPerformance, funnel, categories, products] =
      await Promise.all([
        analyticsRepository.getSalesOverview(period),
        analyticsRepository.getCustomerMetrics(period),
        analyticsRepository.getSalesTrend(period),
        analyticsRepository.getProductPerformance(period),
        analyticsRepository.getShoppingFunnel(period),
        catalogService.getCategories(),
        catalogService.getProducts(),
      ]);

    // Build category performance by cross-referencing products with sales
    const categoryMap = new Map<string, CategoryPerformanceMetric>();

    for (const cat of categories) {
      categoryMap.set(cat.slug, {
        categoryName: cat.name,
        categorySlug: cat.slug,
        revenueRupees: 0,
        ordersCount: 0,
        views: 0,
      });
    }

    // Match product metrics to categories
    for (const prodPerf of productPerformance) {
      const catalogProd = products.find((p) => p.slug === prodPerf.productSlug);
      if (catalogProd && catalogProd.category) {
        const catSlug = catalogProd.category.slug;
        const existing = categoryMap.get(catSlug) || {
          categoryName: catalogProd.category.name,
          categorySlug: catSlug,
          revenueRupees: 0,
          ordersCount: 0,
          views: 0,
        };

        existing.revenueRupees += prodPerf.revenueRupees;
        existing.ordersCount += prodPerf.purchases;
        existing.views += prodPerf.views;
        categoryMap.set(catSlug, existing);
      }
    }

    const categoryPerformance = Array.from(categoryMap.values()).sort(
      (a, b) => b.revenueRupees - a.revenueRupees || b.ordersCount - a.ordersCount
    );

    return {
      period,
      overview,
      customerMetrics,
      salesTrend,
      productPerformance,
      funnel,
      categoryPerformance,
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
