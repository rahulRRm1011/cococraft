import { BaseRepository } from './base.repository.js';
import { CartRecord, CartItemRecord } from '../types/cart.js';

export class CartRepository extends BaseRepository {
  /**
   * Creates a new cart with a cryptographically secure UUID
   */
  public async createCart(id: string): Promise<CartRecord> {
    const { data, error } = await this.supabase
      .from('carts')
      .insert({ id, status: 'active' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create cart: ${error.message}`);
    }

    return data as CartRecord;
  }

  /**
   * Finds a cart by its ID
   */
  public async findCartById(id: string): Promise<CartRecord | null> {
    const { data, error } = await this.supabase
      .from('carts')
      .select('id, status, created_at, updated_at')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) return null;
    return data as CartRecord;
  }

  /**
   * Retrieves all items in a cart
   */
  public async findCartItems(cartId: string): Promise<CartItemRecord[]> {
    const { data, error } = await this.supabase
      .from('cart_items')
      .select('id, cart_id, product_document_id, product_slug, quantity, unit_price, created_at, updated_at')
      .eq('cart_id', cartId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((item: any) => ({
      ...item,
      unit_price: Number(item.unit_price),
    })) as CartItemRecord[];
  }

  /**
   * Finds a cart item by cart ID and product documentId
   */
  public async findCartItemByDocumentId(cartId: string, documentId: string): Promise<CartItemRecord | null> {
    const { data, error } = await this.supabase
      .from('cart_items')
      .select('id, cart_id, product_document_id, product_slug, quantity, unit_price, created_at, updated_at')
      .eq('cart_id', cartId)
      .eq('product_document_id', documentId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      unit_price: Number(data.unit_price),
    } as CartItemRecord;
  }

  /**
   * Finds a cart item by its numeric ID within a specific cart
   */
  public async findCartItemById(cartId: string, itemId: number): Promise<CartItemRecord | null> {
    const { data, error } = await this.supabase
      .from('cart_items')
      .select('id, cart_id, product_document_id, product_slug, quantity, unit_price, created_at, updated_at')
      .eq('cart_id', cartId)
      .eq('id', itemId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      unit_price: Number(data.unit_price),
    } as CartItemRecord;
  }

  /**
   * Adds an item or updates existing item quantity in a cart
   */
  public async upsertItem(
    cartId: string,
    documentId: string,
    slug: string,
    quantityToAdd: number,
    unitPrice: number
  ): Promise<CartItemRecord> {
    const existing = await this.findCartItemByDocumentId(cartId, documentId);

    if (existing) {
      const newQuantity = Math.min(existing.quantity + quantityToAdd, 99);
      const now = new Date().toISOString();
      const { data, error } = await this.supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
          unit_price: unitPrice,
          updated_at: now,
        })
        .eq('id', existing.id)
        .eq('cart_id', cartId)
        .select()
        .single();

      if (error) throw error;
      await this.touchCart(cartId);
      return { ...data, unit_price: Number(data.unit_price) } as CartItemRecord;
    } else {
      const { data, error } = await this.supabase
        .from('cart_items')
        .insert({
          cart_id: cartId,
          product_document_id: documentId,
          product_slug: slug,
          quantity: quantityToAdd,
          unit_price: unitPrice,
        })
        .select()
        .single();

      if (error) throw error;
      await this.touchCart(cartId);
      return { ...data, unit_price: Number(data.unit_price) } as CartItemRecord;
    }
  }

  /**
   * Updates an item's quantity
   */
  public async updateItemQuantity(
    cartId: string,
    itemId: number,
    quantity: number
  ): Promise<CartItemRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('cart_items')
      .update({ quantity, updated_at: now })
      .eq('id', itemId)
      .eq('cart_id', cartId)
      .select()
      .single();

    if (error || !data) return null;
    await this.touchCart(cartId);
    return { ...data, unit_price: Number(data.unit_price) } as CartItemRecord;
  }

  /**
   * Updates an item's unit_price (e.g. during price sync with Strapi)
   */
  public async updateItemUnitPrice(
    cartId: string,
    itemId: number,
    unitPrice: number
  ): Promise<void> {
    await this.supabase
      .from('cart_items')
      .update({ unit_price: unitPrice, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('cart_id', cartId);
    await this.touchCart(cartId);
  }

  public async updateItemPrice(
    cartId: string,
    itemId: number,
    unitPrice: number
  ): Promise<void> {
    return this.updateItemUnitPrice(cartId, itemId, unitPrice);
  }

  /**
   * Removes an item from the cart
   */
  public async removeItem(cartId: string, itemId: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('cart_id', cartId);

    if (error) return false;
    await this.touchCart(cartId);
    return true;
  }

  /**
   * Clears all items in a cart
   */
  public async clearCart(cartId: string): Promise<void> {
    await this.supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);
    await this.touchCart(cartId);
  }

  /**
   * Touches the updated_at timestamp of a cart
   */
  public async touchCart(cartId: string): Promise<void> {
    await this.supabase
      .from('carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cartId);
  }

  /**
   * Marks a cart as completed (order created)
   */
  public async markCartCompleted(cartId: string): Promise<void> {
    await this.supabase
      .from('carts')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', cartId);
  }
}

export const cartRepository = new CartRepository();
