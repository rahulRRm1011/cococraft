import { BaseRepository } from './base.repository.js';
import {
  CustomerRecord,
  CustomerSessionRecord,
  CustomerAddressRecord,
  CreateAddressInput,
  UpdateAddressInput,
} from '../types/customer.js';

export interface CreateCustomerParams {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone?: string | null;
}

export interface CreateSessionParams {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface CreateAddressParams {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault: number;
}

export class CustomerRepository extends BaseRepository {
  /**
   * Creates a new customer account
   */
  public async createCustomer(params: CreateCustomerParams): Promise<CustomerRecord> {
    const { data, error } = await this.supabase
      .from('customers')
      .insert({
        id: params.id,
        email: params.email.trim().toLowerCase(),
        password_hash: params.passwordHash,
        name: params.name.trim(),
        phone: params.phone?.trim() || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    return data as CustomerRecord;
  }

  /**
   * Finds customer by email address (case-insensitive)
   */
  public async findCustomerByEmail(email: string): Promise<CustomerRecord | null> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error || !data) return null;
    return data as CustomerRecord;
  }

  /**
   * Finds customer by ID
   */
  public async findCustomerById(id: string): Promise<CustomerRecord | null> {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as CustomerRecord;
  }

  /**
   * Updates last login timestamp
   */
  public async updateCustomerLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from('customers')
      .update({ last_login_at: now, updated_at: now })
      .eq('id', id);
  }

  /**
   * Updates customer personal profile details
   */
  public async updateCustomerProfile(
    id: string,
    name: string,
    phone: string | null
  ): Promise<CustomerRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('customers')
      .update({ name, phone, updated_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return data as CustomerRecord;
  }

  /**
   * Updates hashed password
   */
  public async updateCustomerPassword(id: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from('customers')
      .update({ password_hash: passwordHash, updated_at: now })
      .eq('id', id);
  }

  /**
   * Creates a persistent customer session
   */
  public async createSession(params: CreateSessionParams): Promise<CustomerSessionRecord> {
    const { data, error } = await this.supabase
      .from('customer_sessions')
      .insert({
        id: params.id,
        customer_id: params.customerId,
        token_hash: params.tokenHash,
        expires_at: params.expiresAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return data as CustomerSessionRecord;
  }

  /**
   * Finds a valid, unexpired customer session by token hash
   */
  public async findValidSession(tokenHash: string): Promise<CustomerSessionRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('customer_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .maybeSingle();

    if (error || !data) return null;

    // Update last_used_at timestamp
    await this.supabase
      .from('customer_sessions')
      .update({ last_used_at: now })
      .eq('id', data.id);

    return data as CustomerSessionRecord;
  }

  /**
   * Deletes a customer session by token hash
   */
  public async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.supabase
      .from('customer_sessions')
      .delete()
      .eq('token_hash', tokenHash);
  }

  /**
   * Deletes all sessions belonging to a specific customer
   */
  public async deleteCustomerSessions(customerId: string): Promise<void> {
    await this.supabase
      .from('customer_sessions')
      .delete()
      .eq('customer_id', customerId);
  }

  /**
   * Creates an address in the customer's address book
   */
  public async createAddress(params: CreateAddressParams): Promise<CustomerAddressRecord> {
    if (params.isDefault === 1) {
      await this.supabase
        .from('customer_addresses')
        .update({ is_default: 0, updated_at: new Date().toISOString() })
        .eq('customer_id', params.customerId);
    }

    const { data, error } = await this.supabase
      .from('customer_addresses')
      .insert({
        id: params.id,
        customer_id: params.customerId,
        name: params.name,
        phone: params.phone,
        address_line_1: params.addressLine1,
        address_line_2: params.addressLine2 || null,
        city: params.city,
        state: params.state,
        postal_code: params.postalCode,
        country: params.country || 'India',
        is_default: params.isDefault,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create address: ${error.message}`);
    }

    return data as CustomerAddressRecord;
  }

  /**
   * Retrieves all saved addresses for a customer
   */
  public async findAddressesByCustomerId(customerId: string): Promise<CustomerAddressRecord[]> {
    const { data, error } = await this.supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as CustomerAddressRecord[];
  }

  /**
   * Counts addresses for a customer
   */
  public async countAddresses(customerId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('customer_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Retrieves a single address by ID and Customer ID
   */
  public async findAddressById(id: string, customerId: string): Promise<CustomerAddressRecord | null> {
    const { data, error } = await this.supabase
      .from('customer_addresses')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error || !data) return null;
    return data as CustomerAddressRecord;
  }

  public async findAddressByIdAndCustomer(id: string, customerId: string): Promise<CustomerAddressRecord | null> {
    return this.findAddressById(id, customerId);
  }

  /**
   * Updates an existing address
   */
  public async updateAddress(
    params: UpdateAddressInput & { id: string; customerId: string }
  ): Promise<CustomerAddressRecord | null> {
    const current = await this.findAddressById(params.id, params.customerId);
    if (!current) return null;

    if (params.isDefault) {
      await this.supabase
        .from('customer_addresses')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('customer_id', params.customerId);
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (params.name !== undefined) updateData.name = params.name;
    if (params.phone !== undefined) updateData.phone = params.phone;
    if (params.addressLine1 !== undefined) updateData.address_line_1 = params.addressLine1;
    if (params.addressLine2 !== undefined) updateData.address_line_2 = params.addressLine2;
    if (params.city !== undefined) updateData.city = params.city;
    if (params.state !== undefined) updateData.state = params.state;
    if (params.postalCode !== undefined) updateData.postal_code = params.postalCode;
    if (params.country !== undefined) updateData.country = params.country;
    if (params.isDefault !== undefined) updateData.is_default = params.isDefault;

    const { data, error } = await this.supabase
      .from('customer_addresses')
      .update(updateData)
      .eq('id', params.id)
      .eq('customer_id', params.customerId)
      .select()
      .single();

    if (error || !data) return null;
    return data as CustomerAddressRecord;
  }

  /**
   * Deletes an address from the customer address book
   */
  public async deleteAddress(id: string, customerId: string): Promise<boolean> {
    const address = await this.findAddressById(id, customerId);
    if (!address) return false;

    const { error } = await this.supabase
      .from('customer_addresses')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId);

    if (error) return false;

    // If default was deleted, promote another address to default if available
    if (address.is_default === 1) {
      const remaining = await this.findAddressesByCustomerId(customerId);
      if (remaining.length > 0) {
        await this.supabase
          .from('customer_addresses')
          .update({ is_default: 1 })
          .eq('id', remaining[0].id);
      }
    }

    return true;
  }

  /**
   * Sets an address as default for the customer
   */
  public async setDefaultAddress(id: string, customerId: string): Promise<CustomerAddressRecord | null> {
    await this.supabase
      .from('customer_addresses')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId);

    const { data, error } = await this.supabase
      .from('customer_addresses')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error || !data) return null;
    return data as CustomerAddressRecord;
  }

  /**
   * Associates past orders matching customer email to the customer's ID
   */
  public async linkGuestOrdersByEmail(customerId: string, email: string): Promise<number> {
    const { data } = await this.supabase
      .from('orders')
      .update({ customer_id: customerId, updated_at: new Date().toISOString() })
      .ilike('customer_email', email.trim().toLowerCase())
      .is('customer_id', null)
      .select('id');

    return data?.length || 0;
  }

  /**
   * Finds customer session by hashed token
   */
  public async findSessionByTokenHash(tokenHash: string): Promise<CustomerSessionRecord | null> {
    const { data, error } = await this.supabase
      .from('customer_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !data) return null;
    return data as CustomerSessionRecord;
  }

  /**
   * Updates last_used_at timestamp on customer session
   */
  public async updateSessionLastUsed(sessionId: string): Promise<void> {
    await this.supabase
      .from('customer_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', sessionId);
  }
}

export const customerRepository = new CustomerRepository();
