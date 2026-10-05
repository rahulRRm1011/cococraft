import { ProductSummary } from './catalog.js';

export interface CartRecord {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CartItemRecord {
  id: number;
  cart_id: string;
  product_document_id: string;
  product_slug: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemProductSummary {
  documentId?: string;
  slug: string;
  name: string;
  image?: string | null;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  stockStatus: string;
}

export interface CartItemResponse {
  id: number;
  product: CartItemProductSummary;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartResponse {
  id: string;
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}

export interface AddToCartInput {
  productSlug?: string;
  productDocumentId?: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}
