import { randomUUID } from 'crypto';
import { cartRepository } from '../repositories/cart.repository.js';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { catalogService } from './catalog.service.js';
import {
  CartResponse,
  CartItemResponse,
  AddToCartInput,
  CartItemRecord,
} from '../types/cart.js';
import { ProductSummary } from '../types/catalog.js';

export class CartService {
  /**
   * Resolves an existing cart or creates a new guest cart
   */
  public async getOrCreateCart(cartId?: string): Promise<CartResponse> {
    if (cartId) {
      const existing = await cartRepository.findCartById(cartId);
      if (existing) {
        return this.getCart(cartId);
      }
    }

    const newId = randomUUID();
    await cartRepository.createCart(newId);
    return {
      id: newId,
      items: [],
      itemCount: 0,
      subtotal: 0,
    };
  }

  /**
   * Retrieves a cart by ID with current catalog-authoritative prices and normalized totals
   */
  public async getCart(cartId: string): Promise<CartResponse> {
    const cart = await cartRepository.findCartById(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    const items = await cartRepository.findCartItems(cartId);
    const normalizedItems: CartItemResponse[] = [];
    let subtotalPaise = 0;
    let totalItemCount = 0;

    for (const item of items) {
      // Server-side authoritative product verification against Strapi catalog
      let product: ProductSummary | null = null;
      if (item.product_document_id) {
        product = await catalogService.getProductByDocumentId(item.product_document_id);
      }
      if (!product && item.product_slug) {
        product = await catalogService.getProductBySlug(item.product_slug);
      }

      // If product no longer exists or was marked inactive, remove it from the cart
      if (!product || !product.isActive) {
        await cartRepository.removeItem(cartId, item.id);
        continue;
      }

      // Authoritative Price Freshness (Section 23):
      // If stored price differs from current Strapi price, update DB snapshot with current price
      const currentPrice = product.price;
      if (item.unit_price !== currentPrice) {
        await cartRepository.updateItemPrice(cartId, item.id, currentPrice);
      }

      // Integer money calculation in paise to prevent floating-point inaccuracies
      const unitPricePaise = Math.round(currentPrice * 100);
      const lineTotalPaise = unitPricePaise * item.quantity;

      subtotalPaise += lineTotalPaise;
      totalItemCount += item.quantity;

      normalizedItems.push({
        id: item.id,
        product: {
          documentId: product.documentId || item.product_document_id,
          slug: product.slug,
          name: product.name,
          image: product.images?.[0] || null,
          category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
                slug: product.category.slug,
              }
            : null,
          stockStatus: product.stockStatus,
        },
        quantity: item.quantity,
        unitPrice: currentPrice,
        lineTotal: lineTotalPaise / 100,
      });
    }

    return {
      id: cart.id,
      items: normalizedItems,
      itemCount: totalItemCount,
      subtotal: subtotalPaise / 100,
    };
  }

  /**
   * Adds an item to the guest cart with strict server-side validation
   */
  public async addItem(cartId: string, input: AddToCartInput): Promise<CartResponse> {
    // 1. Quantity Validation (Section 8)
    const quantity = this.validateQuantity(input.quantity);

    // 2. Ensure or initialize cart
    let cart = await cartRepository.findCartById(cartId);
    if (!cart) {
      cart = await cartRepository.createCart(cartId);
    }

    // 3. Find and validate product authoritatively from Strapi
    let product: ProductSummary | null = null;
    if (input.productSlug) {
      product = await catalogService.getProductBySlug(input.productSlug);
    } else if (input.productDocumentId) {
      product = await catalogService.getProductByDocumentId(input.productDocumentId);
    }

    if (!product) {
      throw new Error(`Product not found: ${input.productSlug || input.productDocumentId}`);
    }

    if (!product.isActive) {
      throw new Error(`Product "${product.name}" is currently unavailable.`);
    }

    // 4. Stock Status Validation (Section 9)
    if (product.stockStatus === 'out_of_stock') {
      throw new Error(`"${product.name}" is currently out of stock and cannot be added to your hamper.`);
    }

    // Check Business Inventory Control Layer
    const invItem = await inventoryRepository.findByProductReference(product.documentId || product.sku || product.slug);
    if (invItem) {
      if (invItem.sellable_quantity <= 0) {
        throw new Error(`"${product.name}" is currently out of stock.`);
      }
      const existingInCart = await cartRepository.findCartItemByDocumentId(cartId, product.documentId || product.slug);
      const totalWanted = (existingInCart ? existingInCart.quantity : 0) + quantity;
      if (totalWanted > invItem.sellable_quantity) {
        const avail = invItem.sellable_quantity;
        throw new Error(`Only ${avail} piece${avail === 1 ? '' : 's'} available.`);
      }
    }

    // 5. Server-authoritative price snapshot
    const serverPrice = product.price;
    const documentId = product.documentId || product.slug;

    // 6. Upsert cart item into business Supabase database
    await cartRepository.upsertItem(cartId, documentId, product.slug, quantity, serverPrice);

    return this.getCart(cartId);
  }

  /**
   * Updates an item's quantity in the cart
   */
  public async updateItemQuantity(cartId: string, itemId: number, newQuantity: number): Promise<CartResponse> {
    const quantity = this.validateQuantity(newQuantity);

    const cart = await cartRepository.findCartById(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    const item = await cartRepository.findCartItemById(cartId, itemId);
    if (!item) {
      throw new Error(`Cart item not found: ${itemId}`);
    }

    // Validate product is still active
    let product: ProductSummary | null = null;
    if (item.product_document_id) {
      product = await catalogService.getProductByDocumentId(item.product_document_id);
    }
    if (!product && item.product_slug) {
      product = await catalogService.getProductBySlug(item.product_slug);
    }

    if (!product || !product.isActive) {
      await cartRepository.removeItem(cartId, itemId);
      throw new Error('This piece is no longer available and was removed from your hamper.');
    }

    if (product.stockStatus === 'out_of_stock') {
      await cartRepository.removeItem(cartId, itemId);
      throw new Error(`"${product.name}" has sold out and was removed from your hamper.`);
    }

    // Check Business Inventory Control Layer
    const invItem = await inventoryRepository.findByProductReference(product.documentId || product.sku || product.slug);
    if (invItem) {
      if (invItem.sellable_quantity <= 0) {
        await cartRepository.removeItem(cartId, itemId);
        throw new Error(`"${product.name}" has sold out and was removed from your hamper.`);
      }
      if (quantity > invItem.sellable_quantity) {
        const avail = invItem.sellable_quantity;
        throw new Error(`Only ${avail} piece${avail === 1 ? '' : 's'} available.`);
      }
    }

    await cartRepository.updateItemQuantity(cartId, itemId, quantity);

    return this.getCart(cartId);
  }

  /**
   * Removes an item from the cart
   */
  public async removeItem(cartId: string, itemId: number): Promise<CartResponse> {
    const cart = await cartRepository.findCartById(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    await cartRepository.removeItem(cartId, itemId);
    return this.getCart(cartId);
  }

  /**
   * Clears all items in the cart
   */
  public async clearCart(cartId: string): Promise<CartResponse> {
    const cart = await cartRepository.findCartById(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    await cartRepository.clearCart(cartId);
    return {
      id: cart.id,
      items: [],
      itemCount: 0,
      subtotal: 0,
    };
  }

  /**
   * Validates that quantity is an integer between 1 and 99
   */
  private validateQuantity(qty: any): number {
    if (typeof qty !== 'number' && typeof qty !== 'string') {
      throw new Error('Quantity must be a valid number.');
    }

    const parsed = typeof qty === 'number' ? qty : Number(qty);

    if (isNaN(parsed) || !Number.isInteger(parsed)) {
      throw new Error('Quantity must be an integer.');
    }

    if (parsed < 1) {
      throw new Error('Quantity must be at least 1.');
    }

    if (parsed > 99) {
      throw new Error('Maximum quantity per piece is 99.');
    }

    return parsed;
  }
}

export const cartService = new CartService();
