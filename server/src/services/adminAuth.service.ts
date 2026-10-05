import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { adminUserRepository } from '../repositories/adminUser.repository.js';
import { adminSessionRepository } from '../repositories/adminSession.repository.js';
import { AdminUser, AdminRole } from '../types/admin.js';

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

export class AdminAuthService {
  private loginAttempts: Map<string, RateLimitEntry> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly SESSION_TTL_HOURS = 12;

  /**
   * Hashes a raw password securely using bcrypt
   */
  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compares raw password with stored hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Hashes a session token with SHA-256 for secure DB persistence
   */
  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Rate limits failed login attempts by key (IP + email)
   */
  private checkRateLimit(key: string): void {
    const entry = this.loginAttempts.get(key);
    if (!entry) return;

    const now = Date.now();
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const waitMins = Math.ceil((entry.blockedUntil - now) / 60000);
      throw new Error(`Too many failed login attempts. Please try again in ${waitMins} minute(s).`);
    }

    // Reset window if expired
    if (now - entry.firstAttemptAt > this.WINDOW_MS) {
      this.loginAttempts.delete(key);
    }
  }

  private recordFailedAttempt(key: string): void {
    const now = Date.now();
    const entry = this.loginAttempts.get(key) || { attempts: 0, firstAttemptAt: now };
    entry.attempts += 1;

    if (entry.attempts >= this.MAX_ATTEMPTS) {
      entry.blockedUntil = now + this.BLOCK_DURATION_MS;
    }

    this.loginAttempts.set(key, entry);
  }

  private clearRateLimit(key: string): void {
    this.loginAttempts.delete(key);
  }

  /**
   * Authenticates admin user with email and password
   */
  public async login(
    email: string,
    password: string,
    clientIp = 'unknown'
  ): Promise<{ token: string; user: AdminUser }> {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = `${clientIp}_${normalizedEmail}`;

    this.checkRateLimit(rateLimitKey);

    const userRecord = await adminUserRepository.findByEmail(normalizedEmail);
    if (!userRecord || !userRecord.is_active) {
      this.recordFailedAttempt(rateLimitKey);
      // Generic error message to prevent account enumeration
      throw new Error('Unable to sign in with those credentials.');
    }

    const isValidPassword = await this.verifyPassword(password, userRecord.password_hash);
    if (!isValidPassword) {
      this.recordFailedAttempt(rateLimitKey);
      throw new Error('Unable to sign in with those credentials.');
    }

    // Login successful: clear rate limits
    this.clearRateLimit(rateLimitKey);

    // Update last login timestamp
    await adminUserRepository.updateLastLogin(userRecord.id);

    // Generate random 256-bit cryptographically secure session token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // Calculate expiry (12 hours)
    const expiresAt = new Date(Date.now() + this.SESSION_TTL_HOURS * 60 * 60 * 1000)
      .toISOString();

    const sessionId = `asess_${crypto.randomUUID()}`;
    await adminSessionRepository.createSession(sessionId, userRecord.id, tokenHash, expiresAt);

    return {
      token: rawToken,
      user: adminUserRepository.toDTO(userRecord),
    };
  }

  /**
   * Validates a session token and returns active admin user
   */
  public async validateToken(rawToken: string): Promise<AdminUser | null> {
    if (!rawToken) return null;
    const tokenHash = this.hashToken(rawToken);
    const valid = await adminSessionRepository.findValidSession(tokenHash);
    if (!valid) return null;

    // Touch session activity
    await adminSessionRepository.touchSession(valid.session.id);

    return adminUserRepository.toDTO(valid.user);
  }

  /**
   * Logs out admin by invalidating server session
   */
  public async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await adminSessionRepository.deleteSessionByTokenHash(tokenHash);
  }

  /**
   * Bootstraps or creates an admin user
   */
  public async createAdmin(
    email: string,
    password: string,
    displayName: string,
    role: AdminRole = 'admin'
  ): Promise<AdminUser> {
    const existing = await adminUserRepository.findByEmail(email);
    if (existing) {
      throw new Error(`Admin user with email ${email} already exists.`);
    }

    const passwordHash = await this.hashPassword(password);
    const id = `adm_${crypto.randomUUID()}`;

    const created = await adminUserRepository.createAdminUser({
      id,
      email,
      passwordHash,
      displayName,
      role,
    });

    return adminUserRepository.toDTO(created);
  }
}

export const adminAuthService = new AdminAuthService();
