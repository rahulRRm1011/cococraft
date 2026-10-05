import { BaseRepository } from './base.repository.js';
import { AdminUserRecord, AdminUser, AdminRole } from '../types/admin.js';

export interface CreateAdminUserParams {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role?: AdminRole;
}

export class AdminUserRepository extends BaseRepository {
  /**
   * Finds an active or inactive admin user by email (case-insensitive)
   */
  public async findByEmail(email: string): Promise<AdminUserRecord | null> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error || !data) return null;
    return data as AdminUserRecord;
  }

  /**
   * Finds an admin user by ID
   */
  public async findById(id: string): Promise<AdminUserRecord | null> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as AdminUserRecord;
  }

  /**
   * Creates a new admin user record
   */
  public async createAdminUser(params: CreateAdminUserParams): Promise<AdminUserRecord> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .insert({
        id: params.id,
        email: params.email.trim().toLowerCase(),
        password_hash: params.passwordHash,
        display_name: params.displayName.trim(),
        role: params.role || 'admin',
        is_active: 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create admin user: ${error.message}`);
    }

    return data as AdminUserRecord;
  }

  /**
   * Updates last_login_at timestamp
   */
  public async updateLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from('admin_users')
      .update({ last_login_at: now, updated_at: now })
      .eq('id', id);
  }

  /**
   * Counts total registered admin users
   */
  public async countUsers(): Promise<number> {
    const { count, error } = await this.supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count || 0;
  }

  /**
   * Normalizes DB record to safe AdminUser DTO (excluding password hash)
   */
  public toDTO(record: AdminUserRecord): AdminUser {
    return {
      id: record.id,
      email: record.email,
      displayName: record.display_name,
      role: record.role,
      isActive: Boolean(record.is_active),
      lastLoginAt: record.last_login_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}

export const adminUserRepository = new AdminUserRepository();
