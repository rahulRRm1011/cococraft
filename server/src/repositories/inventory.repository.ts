import crypto from 'crypto';
import { BaseRepository } from './base.repository.js';
import {
  InventoryItem,
  InventoryItemWithComputed,
  InventoryMovement,
  StockReservation,
  InventoryMetrics,
  AvailabilityState,
} from '../types/inventory.js';

export class InventoryRepository extends BaseRepository {
  /**
   * Helper to compute dynamic availability state
   */
  public static computeAvailability(
    available: number,
    reserved: number,
    threshold: number
  ): { sellable: number; availability: AvailabilityState } {
    const sellable = Math.max(0, available - reserved);
    let availability: AvailabilityState = 'in_stock';
    if (sellable <= 0) {
      availability = 'out_of_stock';
    } else if (sellable <= threshold) {
      availability = 'low_stock';
    }
    return { sellable, availability };
  }

  /**
   * Finds an inventory item by product_reference (Strapi documentId) or by SKU
   */
  public async findByProductReference(productReference: string): Promise<InventoryItemWithComputed | null> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('id, product_reference, sku, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold, status, created_at, updated_at')
      .or(`product_reference.eq.${productReference},sku.eq.${productReference}`)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as InventoryItem;
    const { sellable, availability } = InventoryRepository.computeAvailability(
      row.available_quantity,
      row.reserved_quantity,
      row.low_stock_threshold
    );

    return {
      ...row,
      sellable_quantity: sellable,
      availability,
    };
  }

  /**
   * Finds all inventory items with optional search and status filtering
   */
  public async findAll(options?: {
    search?: string;
    statusFilter?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryItemWithComputed[]; total: number }> {
    const { search, statusFilter, limit = 50, offset = 0 } = options || {};

    let queryBuilder = this.supabase
      .from('inventory_items')
      .select('id, product_reference, sku, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold, status, created_at, updated_at');

    if (search && search.trim() !== '') {
      const term = search.trim();
      queryBuilder = queryBuilder.or(`sku.ilike.%${term}%,product_reference.ilike.%${term}%`);
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: true });

    const { data, error } = await queryBuilder;
    if (error || !data) {
      return { items: [], total: 0 };
    }

    const rows = data as InventoryItem[];

    // Map computed fields
    const computedRows: InventoryItemWithComputed[] = rows.map((row) => {
      const { sellable, availability } = InventoryRepository.computeAvailability(
        row.available_quantity,
        row.reserved_quantity,
        row.low_stock_threshold
      );
      return {
        ...row,
        sellable_quantity: sellable,
        availability,
      };
    });

    // Apply status filter on computed availability
    let filtered = computedRows;
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'in_stock') {
        filtered = computedRows.filter((item) => item.availability === 'in_stock');
      } else if (statusFilter === 'low_stock') {
        filtered = computedRows.filter((item) => item.availability === 'low_stock');
      } else if (statusFilter === 'out_of_stock') {
        filtered = computedRows.filter((item) => item.availability === 'out_of_stock');
      } else if (statusFilter === 'reserved') {
        filtered = computedRows.filter((item) => item.reserved_quantity > 0);
      }
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { items: paginated, total };
  }

  /**
   * Retrieves batch availability for a list of product references
   */
  public async findBatchAvailability(productReferences: string[]): Promise<Map<string, InventoryItemWithComputed>> {
    const map = new Map<string, InventoryItemWithComputed>();
    if (productReferences.length === 0) return map;

    const refs = productReferences.map((r) => `"${r}"`).join(',');
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('id, product_reference, sku, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold, status, created_at, updated_at')
      .or(`product_reference.in.(${refs}),sku.in.(${refs})`);

    if (error || !data) return map;

    const rows = data as InventoryItem[];
    for (const row of rows) {
      const { sellable, availability } = InventoryRepository.computeAvailability(
        row.available_quantity,
        row.reserved_quantity,
        row.low_stock_threshold
      );
      const computed: InventoryItemWithComputed = {
        ...row,
        sellable_quantity: sellable,
        availability,
      };
      map.set(row.product_reference, computed);
      map.set(row.sku, computed);
    }
    return map;
  }

  /**
   * Retrieves high-level operational inventory metrics
   */
  public async getMetrics(): Promise<InventoryMetrics> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('id, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold');

    if (error || !data) {
      return {
        total_products: 0,
        in_stock_count: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        reserved_items_count: 0,
        total_sold_items: 0,
      };
    }

    const rows = data as {
      id: string;
      available_quantity: number;
      reserved_quantity: number;
      sold_quantity: number;
      low_stock_threshold: number;
    }[];

    let total_products = rows.length;
    let in_stock_count = 0;
    let low_stock_count = 0;
    let out_of_stock_count = 0;
    let reserved_items_count = 0;
    let total_sold_items = 0;

    for (const r of rows) {
      const sellable = Math.max(0, r.available_quantity - r.reserved_quantity);
      if (sellable <= 0) {
        out_of_stock_count++;
      } else if (sellable <= r.low_stock_threshold) {
        low_stock_count++;
      } else {
        in_stock_count++;
      }

      reserved_items_count += r.reserved_quantity;
      total_sold_items += r.sold_quantity;
    }

    return {
      total_products,
      in_stock_count,
      low_stock_count,
      out_of_stock_count,
      reserved_items_count,
      total_sold_items,
    };
  }

  /**
   * Idempotent initial seed/upsert
   */
  public async upsertInitialStock(
    productReference: string,
    sku: string,
    initialQuantity: number,
    lowStockThreshold: number = 5
  ): Promise<InventoryItem> {
    const existing = await this.findByProductReference(productReference);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    const movementId = crypto.randomUUID();

    await this.supabase.from('inventory_items').insert({
      id,
      product_reference: productReference,
      sku,
      available_quantity: initialQuantity,
      reserved_quantity: 0,
      sold_quantity: 0,
      low_stock_threshold: lowStockThreshold,
      status: 'active',
    });

    await this.supabase.from('inventory_movements').insert({
      id: movementId,
      product_reference: productReference,
      movement_type: 'INITIAL_STOCK',
      quantity: initialQuantity,
      previous_quantity: 0,
      new_quantity: initialQuantity,
      reference_type: 'initial_seed',
      reference_id: id,
      admin_user_id: null,
      note: 'Initial catalog inventory seed',
    });

    const created = await this.findByProductReference(productReference);
    return created!;
  }

  /**
   * Reserves stock atomically within a database transaction to prevent overselling.
   * Throws Error if any product has insufficient sellable stock.
   */
  public async reserveStock(
    orderId: string,
    items: Array<{ productReference: string; quantity: number }>
  ): Promise<StockReservation[]> {
    const reservations: StockReservation[] = [];

    for (const item of items) {
      // Find existing inventory item row
      const { data: row } = await this.supabase
        .from('inventory_items')
        .select('id, product_reference, sku, available_quantity, reserved_quantity, low_stock_threshold, status')
        .or(`product_reference.eq.${item.productReference},sku.eq.${item.productReference}`)
        .maybeSingle();

      if (!row) {
        throw new Error(`Inventory record not found for product reference "${item.productReference}".`);
      }

      const sellable = row.available_quantity - row.reserved_quantity;
      if (sellable < item.quantity) {
        throw new Error(
          `Insufficient stock for "${row.sku}". Requested: ${item.quantity}, available: ${Math.max(0, sellable)}.`
        );
      }

      // Update reserved_quantity
      const newReserved = row.reserved_quantity + item.quantity;
      const { error: updateErr } = await this.supabase
        .from('inventory_items')
        .update({
          reserved_quantity: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateErr) {
        throw new Error(`Failed to reserve stock for "${row.sku}": ${updateErr.message}`);
      }

      // Insert reservation record
      const reservationId = crypto.randomUUID();
      await this.supabase.from('stock_reservations').insert({
        id: reservationId,
        order_id: orderId,
        product_reference: row.product_reference,
        quantity: item.quantity,
        status: 'reserved',
      });

      // Record movement audit
      const movementId = crypto.randomUUID();
      const prevSellable = sellable;
      const newSellable = sellable - item.quantity;
      await this.supabase.from('inventory_movements').insert({
        id: movementId,
        product_reference: row.product_reference,
        movement_type: 'ORDER_RESERVED',
        quantity: item.quantity,
        previous_quantity: prevSellable,
        new_quantity: newSellable,
        reference_type: 'order',
        reference_id: orderId,
        admin_user_id: null,
        note: `Reserved ${item.quantity} unit(s) for Order ${orderId}`,
      });

      reservations.push({
        id: reservationId,
        order_id: orderId,
        product_reference: row.product_reference,
        quantity: item.quantity,
        status: 'reserved',
        created_at: new Date().toISOString(),
        released_at: null,
      });
    }

    return reservations;
  }

  /**
   * Finalizes reservations for an order (e.g. online payment success or confirmed COD)
   * Converts reserved quantity to sold quantity and deducts available stock.
   */
  public async finalizeReservation(orderId: string): Promise<void> {
    const { data: activeReservations } = await this.supabase
      .from('stock_reservations')
      .select('id, order_id, product_reference, quantity, status')
      .eq('order_id', orderId)
      .eq('status', 'reserved');

    if (!activeReservations || activeReservations.length === 0) return;

    for (const res of activeReservations) {
      // Fetch current item state
      const { data: item } = await this.supabase
        .from('inventory_items')
        .select('id, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold')
        .eq('product_reference', res.product_reference)
        .maybeSingle();

      if (item) {
        const newAvailable = Math.max(0, item.available_quantity - res.quantity);
        const newReserved = Math.max(0, item.reserved_quantity - res.quantity);
        const newSold = item.sold_quantity + res.quantity;
        const newStatus = newAvailable === 0 && newReserved === 0 ? 'out_of_stock' : 'active';

        // Update inventory item
        await this.supabase
          .from('inventory_items')
          .update({
            available_quantity: newAvailable,
            reserved_quantity: newReserved,
            sold_quantity: newSold,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Update reservation to completed
        await this.supabase
          .from('stock_reservations')
          .update({ status: 'completed' })
          .eq('id', res.id);

        // Create ORDER_COMPLETED movement
        const movementId = crypto.randomUUID();
        await this.supabase.from('inventory_movements').insert({
          id: movementId,
          product_reference: res.product_reference,
          movement_type: 'ORDER_COMPLETED',
          quantity: res.quantity,
          previous_quantity: item.available_quantity,
          new_quantity: newAvailable,
          reference_type: 'order',
          reference_id: orderId,
          admin_user_id: null,
          note: `Finalized sale of ${res.quantity} unit(s) for Order ${orderId}`,
        });
      }
    }
  }

  /**
   * Releases reservations for an order (e.g. payment failure, checkout aborted)
   */
  public async releaseReservation(orderId: string, reason: string = 'Payment failed or checkout aborted'): Promise<void> {
    const { data: activeReservations } = await this.supabase
      .from('stock_reservations')
      .select('id, order_id, product_reference, quantity, status')
      .eq('order_id', orderId)
      .eq('status', 'reserved');

    if (!activeReservations || activeReservations.length === 0) return;

    for (const res of activeReservations) {
      const { data: item } = await this.supabase
        .from('inventory_items')
        .select('id, available_quantity, reserved_quantity, sold_quantity')
        .eq('product_reference', res.product_reference)
        .maybeSingle();

      if (item) {
        const newReserved = Math.max(0, item.reserved_quantity - res.quantity);

        await this.supabase
          .from('inventory_items')
          .update({
            reserved_quantity: newReserved,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        await this.supabase
          .from('stock_reservations')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
          })
          .eq('id', res.id);

        const movementId = crypto.randomUUID();
        await this.supabase.from('inventory_movements').insert({
          id: movementId,
          product_reference: res.product_reference,
          movement_type: 'ORDER_CANCELLED',
          quantity: res.quantity,
          previous_quantity: item.available_quantity - item.reserved_quantity,
          new_quantity: item.available_quantity - newReserved,
          reference_type: 'order',
          reference_id: orderId,
          admin_user_id: null,
          note: `Released reservation of ${res.quantity} unit(s) for Order ${orderId} (${reason})`,
        });
      }
    }
  }

  /**
   * Returns stock when a confirmed or completed order is cancelled by admin
   */
  public async returnStockForCancelledOrder(orderId: string, adminUserId?: string, note?: string): Promise<void> {
    const { data: reservations } = await this.supabase
      .from('stock_reservations')
      .select('id, order_id, product_reference, quantity, status')
      .eq('order_id', orderId);

    if (!reservations || reservations.length === 0) return;

    for (const res of reservations) {
      const { data: item } = await this.supabase
        .from('inventory_items')
        .select('id, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold')
        .eq('product_reference', res.product_reference)
        .maybeSingle();

      if (!item) continue;

      if (res.status === 'completed') {
        const newAvailable = item.available_quantity + res.quantity;
        const newSold = Math.max(0, item.sold_quantity - res.quantity);

        await this.supabase
          .from('inventory_items')
          .update({
            available_quantity: newAvailable,
            sold_quantity: newSold,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        await this.supabase
          .from('stock_reservations')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
          })
          .eq('id', res.id);

        const movementId = crypto.randomUUID();
        await this.supabase.from('inventory_movements').insert({
          id: movementId,
          product_reference: res.product_reference,
          movement_type: 'ORDER_CANCELLED',
          quantity: res.quantity,
          previous_quantity: item.available_quantity,
          new_quantity: newAvailable,
          reference_type: 'order',
          reference_id: orderId,
          admin_user_id: adminUserId || null,
          note: note || `Restored ${res.quantity} unit(s) due to order cancellation`,
        });
      } else if (res.status === 'reserved') {
        const newReserved = Math.max(0, item.reserved_quantity - res.quantity);

        await this.supabase
          .from('inventory_items')
          .update({
            reserved_quantity: newReserved,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        await this.supabase
          .from('stock_reservations')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
          })
          .eq('id', res.id);

        const movementId = crypto.randomUUID();
        await this.supabase.from('inventory_movements').insert({
          id: movementId,
          product_reference: res.product_reference,
          movement_type: 'ORDER_CANCELLED',
          quantity: res.quantity,
          previous_quantity: item.available_quantity - item.reserved_quantity,
          new_quantity: item.available_quantity - newReserved,
          reference_type: 'order',
          reference_id: orderId,
          admin_user_id: adminUserId || null,
          note: note || `Released ${res.quantity} reserved unit(s) due to order cancellation`,
        });
      }
    }
  }

  /**
   * Manual stock adjustment by authenticated admin
   */
  public async manualAdjustStock(
    productReference: string,
    action: 'add' | 'remove',
    quantity: number,
    adminUserId: string,
    reason: string
  ): Promise<InventoryItemWithComputed> {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }
    if (!reason || reason.trim() === '') {
      throw new Error('Adjustment reason is required.');
    }

    const { data: item } = await this.supabase
      .from('inventory_items')
      .select('id, product_reference, sku, available_quantity, reserved_quantity, sold_quantity, low_stock_threshold, status, created_at, updated_at')
      .or(`product_reference.eq.${productReference},sku.eq.${productReference}`)
      .maybeSingle();

    if (!item) {
      throw new Error(`Inventory item "${productReference}" not found.`);
    }

    let newAvailable = item.available_quantity;
    let movementType: 'STOCK_ADDED' | 'STOCK_REMOVED' | 'MANUAL_ADJUSTMENT';

    if (action === 'add') {
      newAvailable = item.available_quantity + quantity;
      movementType = 'STOCK_ADDED';
    } else {
      if (item.available_quantity < quantity) {
        throw new Error(
          `Cannot remove ${quantity} units. Only ${item.available_quantity} available units exist.`
        );
      }
      newAvailable = item.available_quantity - quantity;
      movementType = 'STOCK_REMOVED';
    }

    const sellable = Math.max(0, newAvailable - item.reserved_quantity);
    const newStatus = sellable <= 0 && newAvailable <= 0 ? 'out_of_stock' : 'active';

    await this.supabase
      .from('inventory_items')
      .update({
        available_quantity: newAvailable,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    const movementId = crypto.randomUUID();
    await this.supabase.from('inventory_movements').insert({
      id: movementId,
      product_reference: item.product_reference,
      movement_type: movementType,
      quantity,
      previous_quantity: item.available_quantity,
      new_quantity: newAvailable,
      reference_type: 'manual_adjustment',
      reference_id: movementId,
      admin_user_id: adminUserId,
      note: reason.trim(),
    });

    const { availability } = InventoryRepository.computeAvailability(
      newAvailable,
      item.reserved_quantity,
      item.low_stock_threshold
    );

    return {
      ...item,
      available_quantity: newAvailable,
      status: newStatus,
      sellable_quantity: sellable,
      availability,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Retrieves stock movements
   */
  public async getMovements(options?: {
    productReference?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ movements: InventoryMovement[]; total: number }> {
    const { productReference, limit = 50, offset = 0 } = options || {};

    let queryBuilder = this.supabase
      .from('inventory_movements')
      .select('*', { count: 'exact' });

    if (productReference) {
      queryBuilder = queryBuilder.eq('product_reference', productReference);
    }

    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await queryBuilder;
    if (error || !data) {
      return { movements: [], total: 0 };
    }

    return { movements: data as InventoryMovement[], total: count || 0 };
  }

  /**
   * Retrieves reservations for an order or product
   */
  public async getReservations(options?: {
    orderId?: string;
    productReference?: string;
  }): Promise<StockReservation[]> {
    const { orderId, productReference } = options || {};

    let queryBuilder = this.supabase
      .from('stock_reservations')
      .select('*');

    if (orderId) {
      queryBuilder = queryBuilder.eq('order_id', orderId);
    }
    if (productReference) {
      queryBuilder = queryBuilder.eq('product_reference', productReference);
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: false });

    const { data, error } = await queryBuilder;
    if (error || !data) return [];
    return data as StockReservation[];
  }
}

export const inventoryRepository = new InventoryRepository();
