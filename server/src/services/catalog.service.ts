import { strapiService } from './strapi.service.js';
import { normalizeCategory, normalizeProduct } from '../utils/normalizer.js';
import {
  CategorySummary,
  ProductSummary,
  ProductFilterQuery,
  PaginatedProductsResult,
  SearchSuggestionResult,
} from '../types/catalog.js';

export class CatalogService {
  /**
   * Retrieves all active categories sorted by sortOrder
   */
  public async getCategories(): Promise<CategorySummary[]> {
    const raw = await strapiService.get('/categories', {
      'populate': '*',
      'sort': 'sortOrder:asc',
      'filters[isActive][$eq]': 'true',
    });

    const items = Array.isArray(raw?.data) ? raw.data : [];
    const categories: CategorySummary[] = [];

    for (const item of items) {
      const normalized = normalizeCategory(item);
      if (normalized && normalized.isActive) {
        categories.push(normalized);
      }
    }

    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Retrieves active products, optionally filtered by category, search query, price, availability, or featured status
   */
  public async getProducts(filter: ProductFilterQuery = {}): Promise<ProductSummary[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      'populate': '*',
      'sort': 'sortOrder:asc',
      'filters[isActive][$eq]': 'true',
    };

    if (filter.featured !== undefined) {
      params['filters[isFeatured][$eq]'] = String(filter.featured);
    }

    const raw = await strapiService.get('/products', params);
    const items = Array.isArray(raw?.data) ? raw.data : [];
    let products: ProductSummary[] = [];

    for (const item of items) {
      const normalized = normalizeProduct(item);
      if (normalized && normalized.isActive) {
        // 1. Enforce category filter if specified
        if (filter.category) {
          const catMatches =
            normalized.category?.slug.toLowerCase() === filter.category.toLowerCase() ||
            String(normalized.category?.id) === filter.category;

          if (!catMatches) continue;
        }

        // 2. Search query across Name, SKU, Description, Materials, Finish, Origin, and Category Name
        if (filter.search && filter.search.trim()) {
          const q = filter.search.trim().toLowerCase();
          const matches =
            normalized.name.toLowerCase().includes(q) ||
            normalized.sku?.toLowerCase().includes(q) ||
            normalized.shortDescription?.toLowerCase().includes(q) ||
            normalized.description?.toLowerCase().includes(q) ||
            normalized.materials?.toLowerCase().includes(q) ||
            normalized.finish?.toLowerCase().includes(q) ||
            normalized.origin?.toLowerCase().includes(q) ||
            normalized.category?.name.toLowerCase().includes(q);

          if (!matches) continue;
        }

        // 3. Price range filter
        if (filter.minPrice !== undefined && normalized.price < filter.minPrice) {
          continue;
        }
        if (filter.maxPrice !== undefined && normalized.price > filter.maxPrice) {
          continue;
        }

        // 4. In-stock availability filter
        if (filter.inStockOnly && normalized.stockStatus === 'out_of_stock') {
          continue;
        }

        products.push(normalized);
      }
    }

    // Sort order
    switch (filter.sortBy) {
      case 'price-asc':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        products.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        products.sort((a, b) => b.id - a.id);
        break;
      case 'featured':
      default:
        products.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || a.sortOrder - b.sortOrder);
        break;
    }

    return products;
  }

  /**
   * Retrieves featured active products
   */
  public async getFeaturedProducts(): Promise<ProductSummary[]> {
    return this.getProducts({ featured: true });
  }

  /**
   * Retrieves a single active product by its unique slug
   */
  public async getProductBySlug(slug: string): Promise<ProductSummary | null> {
    if (!slug) return null;

    const raw = await strapiService.get('/products', {
      'populate': '*',
      'filters[slug][$eq]': slug,
      'filters[isActive][$eq]': 'true',
    });

    const items = Array.isArray(raw?.data) ? raw.data : [];
    if (items.length === 0) return null;

    const normalized = normalizeProduct(items[0]);
    if (!normalized || !normalized.isActive) return null;

    return normalized;
  }

  /**
   * Retrieves a single active product by its Strapi documentId
   */
  public async getProductByDocumentId(documentId: string): Promise<ProductSummary | null> {
    if (!documentId) return null;

    const raw = await strapiService.get('/products', {
      'populate': '*',
      'filters[documentId][$eq]': documentId,
      'filters[isActive][$eq]': 'true',
    });

    const items = Array.isArray(raw?.data) ? raw.data : [];
    if (items.length === 0) return null;

    const normalized = normalizeProduct(items[0]);
    if (!normalized || !normalized.isActive) return null;

    return normalized;
  }

  /**
   * Retrieves active products within a given category slug
   */
  public async getProductsByCategory(categorySlug: string): Promise<ProductSummary[]> {
    return this.getProducts({ category: categorySlug });
  }

  /**
   * Server-side paginated & multi-filtered product query
   */
  public async getPaginatedProducts(filter: ProductFilterQuery = {}): Promise<PaginatedProductsResult> {
    const all = await this.getProducts(filter);
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 12));
    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const slice = all.slice(offset, offset + limit);

    return {
      products: slice,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Fast search suggestions across catalog products and categories
   */
  public async getSearchSuggestions(rawQuery: string): Promise<SearchSuggestionResult> {
    const q = (rawQuery || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return { query: rawQuery, products: [], categories: [] };
    }

    const [allProducts, allCategories] = await Promise.all([
      this.getProducts(),
      this.getCategories(),
    ]);

    const matchedCategories = allCategories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      .slice(0, 4)
      .map((c) => ({ name: c.name, slug: c.slug }));

    const matchedProducts = allProducts
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.category?.name.toLowerCase().includes(q) ||
        p.shortDescription?.toLowerCase().includes(q) ||
        p.materials?.toLowerCase().includes(q)
      )
      .slice(0, 6)
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        price: p.price,
        category: p.category?.name,
        image: p.images[0] || null,
      }));

    return {
      query: rawQuery,
      products: matchedProducts,
      categories: matchedCategories,
    };
  }

  /**
   * Generates standard valid XML sitemap for public SEO discoverability
   */
  public async generateSitemapXml(baseUrl = 'http://localhost:5173'): Promise<string> {
    const [allProducts, allCategories] = await Promise.all([
      this.getProducts(),
      this.getCategories(),
    ]);

    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static primary pages
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${baseUrl}/products</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;

    // Category pages
    for (const cat of allCategories) {
      xml += `  <url>\n    <loc>${baseUrl}/products?category=${cat.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // Product detail pages
    for (const prod of allProducts) {
      xml += `  <url>\n    <loc>${baseUrl}/products/${prod.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;
    return xml;
  }
}

export const catalogService = new CatalogService();
