import { config } from '../config/env.js';
import { CategorySummary, ProductSummary, StockStatus } from '../types/catalog.js';

/**
 * Ensures media URLs are absolute by prepending Strapi Base URL if needed
 */
export function normalizeMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanBase = config.strapiUrl.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Normalizes description whether it's plain text, markdown, or Strapi blocks
 */
function normalizeDescription(desc: any): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (Array.isArray(desc)) {
    // Extract text from Strapi rich text blocks
    return desc
      .map((block: any) => {
        if (block.children && Array.isArray(block.children)) {
          return block.children.map((c: any) => c.text || '').join('');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }
  return String(desc);
}

/**
 * Normalizes a raw Strapi category item
 */
export function normalizeCategory(raw: any): CategorySummary | null {
  if (!raw) return null;
  const item = raw.attributes ? { id: raw.id, ...raw.attributes } : raw;

  if (!item.name || !item.slug) return null;

  let imageUrl: string | null = null;
  if (item.image) {
    const imgData = item.image.data ? item.image.data.attributes || item.image.data : item.image;
    imageUrl = normalizeMediaUrl(imgData.url);
  }

  return {
    id: item.id,
    documentId: item.documentId,
    name: item.name,
    slug: item.slug,
    description: item.description || '',
    image: imageUrl,
    isActive: item.isActive ?? true,
    sortOrder: item.sortOrder ?? 0,
  };
}

/**
 * Normalizes a raw Strapi product item
 */
export function normalizeProduct(raw: any): ProductSummary | null {
  if (!raw) return null;
  const item = raw.attributes ? { id: raw.id, ...raw.attributes } : raw;

  // Products must have a valid name and slug
  if (!item.name || !item.slug) return null;

  // Extract images array
  const images: string[] = [];
  if (item.images) {
    const rawImages = Array.isArray(item.images)
      ? item.images
      : item.images.data
      ? Array.isArray(item.images.data)
        ? item.images.data
        : [item.images.data]
      : [];

    for (const img of rawImages) {
      const imgObj = img.attributes || img;
      const fullUrl = normalizeMediaUrl(imgObj.url);
      if (fullUrl) {
        images.push(fullUrl);
      }
    }
  }

  // Normalize category if relation populated
  let category: CategorySummary | null = null;
  if (item.category) {
    const catData = item.category.data ? item.category.data : item.category;
    category = normalizeCategory(catData);
  }

  // Validate stockStatus
  const validStockStatuses: StockStatus[] = ['in_stock', 'low_stock', 'out_of_stock'];
  const stockStatus: StockStatus = validStockStatuses.includes(item.stockStatus)
    ? item.stockStatus
    : 'in_stock';

  return {
    id: item.id,
    documentId: item.documentId,
    name: item.name,
    slug: item.slug,
    shortDescription: item.shortDescription || '',
    description: normalizeDescription(item.description),
    price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
    compareAtPrice: item.compareAtPrice != null ? parseFloat(item.compareAtPrice) : null,
    sku: item.sku || undefined,
    images,
    category,
    isFeatured: Boolean(item.isFeatured),
    isActive: item.isActive ?? true,
    stockStatus,
    sortOrder: item.sortOrder ?? 0,
    materials: item.materials ? String(item.materials).trim() : null,
    finish: item.finish ? String(item.finish).trim() : null,
    origin: item.origin ? String(item.origin).trim() : null,
  };
}
