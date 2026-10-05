export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface CategorySummary {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ProductSummary {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  sku?: string;
  images: string[];
  category?: CategorySummary | null;
  isFeatured: boolean;
  isActive: boolean;
  stockStatus: StockStatus;
  sortOrder: number;
  materials?: string | null;
  finish?: string | null;
  origin?: string | null;
}

export interface ProductFilterQuery {
  category?: string;
  featured?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sortBy?: 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'newest';
  page?: number;
  limit?: number;
}

export interface PaginatedProductsResult {
  products: ProductSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SearchSuggestionResult {
  query: string;
  products: Array<{
    name: string;
    slug: string;
    price: number;
    category?: string;
    image?: string | null;
  }>;
  categories: Array<{
    name: string;
    slug: string;
  }>;
}
