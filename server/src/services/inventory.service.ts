import { InventoryRepository } from '../repositories/inventory.repository.js';
import { catalogService } from './catalog.service.js';
import {
  ProductAvailabilityResponse,
  AdminInventoryItemRecord,
  InventoryMetrics,
  InventoryMovement,
  StockReservation,
  StockAdjustmentInput,
} from '../types/inventory.js';

export class InventoryService {
  private repo = new InventoryRepository();

  /**
   * Helper to format customer display message based on availability state
   */
  private formatDisplayMessage(availability: 'in_stock' | 'low_stock' | 'out_of_stock'): string {
    switch (availability) {
      case 'out_of_stock':
        return 'Out of Stock';
      case 'low_stock':
        return 'Only a few pieces remaining';
      case 'in_stock':
      default:
        return 'In Stock';
    }
  }

  /**
   * Helper to resolve product reference (handles documentId, SKU, or slug)
   */
  private async resolveInventoryRecord(reference: string) {
    let item = await this.repo.findByProductReference(reference);
    if (item) return item;

    // Check if reference is a slug or documentId in Strapi
    const product = await catalogService.getProductBySlug(reference).catch(() => null);
    if (product && product.documentId) {
      item = await this.repo.findByProductReference(product.documentId);
      if (item) return item;
    }

    return null;
  }

  /**
   * Public storefront availability for a single product
   */
  public async getProductAvailability(reference: string): Promise<ProductAvailabilityResponse | null> {
    const item = await this.resolveInventoryRecord(reference);
    if (!item) return null;

    return {
      product_reference: item.product_reference,
      sku: item.sku,
      availability: item.availability,
      can_purchase: item.sellable_quantity > 0,
      display_message: this.formatDisplayMessage(item.availability),
    };
  }

  /**
   * Batch availability for storefront catalog/listing pages
   */
  public async getBatchAvailability(
    references?: string[]
  ): Promise<Record<string, ProductAvailabilityResponse>> {
    const results: Record<string, ProductAvailabilityResponse> = {};

    if (references && references.length > 0) {
      const batchMap = await this.repo.findBatchAvailability(references);
      for (const ref of references) {
        const item = batchMap.get(ref);
        if (item) {
          results[ref] = {
            product_reference: item.product_reference,
            sku: item.sku,
            availability: item.availability,
            can_purchase: item.sellable_quantity > 0,
            display_message: this.formatDisplayMessage(item.availability),
          };
        }
      }
    } else {
      const { items } = await this.repo.findAll({ limit: 1000 });
      for (const item of items) {
        const resp: ProductAvailabilityResponse = {
          product_reference: item.product_reference,
          sku: item.sku,
          availability: item.availability,
          can_purchase: item.sellable_quantity > 0,
          display_message: this.formatDisplayMessage(item.availability),
        };
        results[item.product_reference] = resp;
        results[item.sku] = resp;
      }
    }

    return results;
  }

  /**
   * Admin inventory list with search, status filtering, and merged Strapi product metadata
   */
  public async getAdminInventory(options?: {
    search?: string;
    statusFilter?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: AdminInventoryItemRecord[];
    metrics: InventoryMetrics;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options?.limit) || 25));
    const offset = (page - 1) * limit;

    const [{ items, total }, metrics] = await Promise.all([
      this.repo.findAll({
        search: options?.search,
        statusFilter: options?.statusFilter,
        limit,
        offset,
      }),
      this.repo.getMetrics(),
    ]);

    // Fetch catalog products from Strapi to enrich records
    const strapiProducts = await catalogService.getProducts().catch(() => []);
    const productByRefMap = new Map<string, any>();
    for (const p of strapiProducts) {
      if (p.documentId) productByRefMap.set(p.documentId, p);
      if (p.sku) productByRefMap.set(p.sku, p);
    }

    const enrichedItems: AdminInventoryItemRecord[] = items.map((item) => {
      const p = productByRefMap.get(item.product_reference) || productByRefMap.get(item.sku);
      return {
        ...item,
        product_name: p?.name || 'Artisan Coconut Shell Item',
        product_slug: p?.slug || '',
        category_name: p?.category?.name || 'Eco Home',
        thumbnail_url: p?.images?.[0] || null,
      };
    });

    return {
      items: enrichedItems,
      metrics,
      total,
      page,
      limit,
    };
  }

  /**
   * Admin detailed view for a single inventory item with Strapi metadata, movements, and reservations
   */
  public async getAdminProductDetail(productReference: string): Promise<{
    item: AdminInventoryItemRecord;
    movements: InventoryMovement[];
    reservations: StockReservation[];
    strapiProduct: any | null;
  } | null> {
    const item = await this.resolveInventoryRecord(productReference);
    if (!item) return null;

    // Fetch Strapi product
    let strapiProduct = null;
    if (item.product_reference) {
      strapiProduct = await catalogService.getProductByDocumentId(item.product_reference).catch(() => null);
    }
    if (!strapiProduct && item.sku) {
      const all = await catalogService.getProducts().catch(() => []);
      strapiProduct = all.find((p) => p.sku === item.sku) || null;
    }

    const [{ movements }, reservations] = await Promise.all([
      this.repo.getMovements({
        productReference: item.product_reference,
        limit: 50,
      }),
      this.repo.getReservations({
        productReference: item.product_reference,
      }),
    ]);

    const enriched: AdminInventoryItemRecord = {
      ...item,
      product_name: strapiProduct?.name || 'Artisan Coconut Shell Item',
      product_slug: strapiProduct?.slug || '',
      category_name: strapiProduct?.category?.name || 'Eco Home',
      thumbnail_url: strapiProduct?.images?.[0] || null,
    };

    return {
      item: enriched,
      movements,
      reservations,
      strapiProduct,
    };
  }

  /**
   * Admin manual stock adjustment
   */
  public async manualAdjustStock(
    productReference: string,
    input: StockAdjustmentInput,
    adminUserId: string
  ) {
    return this.repo.manualAdjustStock(
      productReference,
      input.action,
      input.quantity,
      adminUserId,
      input.reason
    );
  }

  /**
   * Admin view for all stock movements
   */
  public async getAdminMovements(options?: {
    productReference?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options?.limit) || 50));
    const offset = (page - 1) * limit;

    const { movements, total } = await this.repo.getMovements({
      productReference: options?.productReference,
      limit,
      offset,
    });

    return {
      movements,
      total,
      page,
      limit,
    };
  }

  /**
   * Reserving stock for an order
   */
  public async reserveOrderStock(orderId: string, items: Array<{ productReference: string; quantity: number }>) {
    return this.repo.reserveStock(orderId, items);
  }

  /**
   * Finalizing reservation (online payment success or COD order placed)
   */
  public async finalizeOrderStock(orderId: string) {
    return this.repo.finalizeReservation(orderId);
  }

  /**
   * Releasing reservation (payment failure or aborted)
   */
  public async releaseOrderStock(orderId: string, reason?: string) {
    return this.repo.releaseReservation(orderId, reason);
  }

  /**
   * Returning stock on cancellation
   */
  public async returnOrderStock(orderId: string, adminUserId?: string, note?: string) {
    return this.repo.returnStockForCancelledOrder(orderId, adminUserId, note);
  }

  /**
   * Direct access to underlying repository
   */
  public getRepository(): InventoryRepository {
    return this.repo;
  }
}

export const inventoryService = new InventoryService();
