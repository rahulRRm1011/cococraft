import { BaseRepository } from './base.repository.js';
import { AdminSessionRecord, AdminUserRecord } from '../types/admin.js';

export class AdminSessionRepository extends BaseRepository {
  /**
   * Creates a new admin session record
   */
  public async createSession(
    id: string,
    adminUserId: string,
    tokenHash: string,
    expiresAt: string
  ): Promise<AdminSessionRecord> {
    const { data, error } = await this.supabase
      .from('admin_sessions')
      .insert({
        id,
        admin_user_id: adminUserId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create admin session: ${error.message}`);
    }

    return data as AdminSessionRecord;
  }

  /**
   * Finds a valid, unexpired session and retrieves associated active admin user
   */
  public async findValidSession(tokenHash: string): Promise<{
    session: AdminSessionRecord;
    user: AdminUserRecord;
  } | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .maybeSingle();

    if (error || !data || !data.admin_users) {
      return null;
    }

    const rawUser = data.admin_users as any;
    if (!rawUser.is_active) {
      return null;
    }

    return {
      session: {
        id: data.id,
        admin_user_id: data.admin_user_id,
        token_hash: data.token_hash,
        expires_at: data.expires_at,
        created_at: data.created_at,
        last_used_at: data.last_used_at,
      },
      user: {
        id: rawUser.id,
        email: rawUser.email,
        password_hash: rawUser.password_hash,
        display_name: rawUser.display_name,
        role: rawUser.role,
        is_active: rawUser.is_active,
        last_login_at: rawUser.last_login_at,
        created_at: rawUser.created_at,
        updated_at: rawUser.updated_at,
      },
    };
  }

  /**
   * Updates last_used_at
   */
  public async touchSession(id: string): Promise<void> {
    await this.supabase
      .from('admin_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);
  }

  /**
   * Deletes session by token hash (logout)
   */
  public async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.supabase
      .from('admin_sessions')
      .delete()
      .eq('token_hash', tokenHash);
  }

  /**
   * Cleans up expired sessions from the database
   */
  public async deleteExpiredSessions(): Promise<number> {
    const now = new Date().toISOString();
    const { data } = await this.supabase
      .from('admin_sessions')
      .delete()
      .lt('expires_at', now)
      .select('id');

    return data?.length || 0;
  }
}

export const adminSessionRepository = new AdminSessionRepository();
