export type InventoryStatus = 'active' | 'inactive' | 'out_of_stock';

export type MovementType =
  | 'INITIAL_STOCK'
  | 'STOCK_ADDED'
  | 'STOCK_REMOVED'
  | 'ORDER_RESERVED'
  | 'ORDER_CANCELLED'
  | 'ORDER_COMPLETED'
  | 'MANUAL_ADJUSTMENT';

export type ReservationStatus = 'reserved' | 'completed' | 'released';

export type AvailabilityState = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: string;
  product_reference: string;
  sku: string;
  available_quantity: number;
  reserved_quantity: number;
  sold_quantity: number;
  low_stock_threshold: number;
  status: InventoryStatus;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemWithComputed extends InventoryItem {
  sellable_quantity: number;
  availability: AvailabilityState;
}

export interface InventoryMovement {
  id: string;
  product_reference: string;
  movement_type: MovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  admin_user_id: string | null;
  note: string | null;
  created_at: string;
}

export interface StockReservation {
  id: string;
  order_id: string;
  product_reference: string;
  quantity: number;
  status: ReservationStatus;
  created_at: string;
  released_at: string | null;
}

export interface ProductAvailabilityResponse {
  product_reference: string;
  sku: string;
  availability: AvailabilityState;
  can_purchase: boolean;
  display_message: string;
}

export interface AdminInventoryItemRecord extends InventoryItemWithComputed {
  product_name?: string;
  product_slug?: string;
  category_name?: string;
  thumbnail_url?: string | null;
}

export interface InventoryMetrics {
  total_products: number;
  in_stock_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  reserved_items_count: number;
  total_sold_items: number;
}

export interface StockAdjustmentInput {
  action: 'add' | 'remove';
  quantity: number;
  reason: string;
}
