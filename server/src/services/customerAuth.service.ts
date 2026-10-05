import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { customerRepository } from '../repositories/customer.repository.js';
import {
  CustomerRecord,
  CustomerDTO,
  RegisterCustomerInput,
  LoginCustomerInput,
} from '../types/customer.js';

export class CustomerAuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly SESSION_TTL_DAYS = 30;

  /**
   * Hashes plain text password securely using bcrypt with 12 salt rounds
   */
  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Verifies plain text password against hashed password
   */
  public async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Hashes raw session token with SHA-256 for persistent database storage
   */
  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Formats raw database customer record into safe public DTO
   */
  public formatCustomerDTO(record: CustomerRecord): CustomerDTO {
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      phone: record.phone,
      status: record.status,
      createdAt: record.created_at,
      lastLoginAt: record.last_login_at,
    };
  }

  /**
   * Validates customer email format
   */
  public validateEmailFormat(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new Error('Email address is required.');
    }
    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      throw new Error('Please enter a valid email address.');
    }
    return normalized;
  }

  /**
   * Enforces minimum password complexity requirements
   */
  public validatePasswordStrength(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one letter and one number.');
    }
  }

  /**
   * Registers a new customer account, creating initial session
   */
  public async register(input: RegisterCustomerInput): Promise<{ customer: CustomerDTO; token: string }> {
    const email = this.validateEmailFormat(input.email);
    const name = (input.name || '').trim();

    if (!name || name.length < 2) {
      throw new Error('Please provide your full name (at least 2 characters).');
    }

    this.validatePasswordStrength(input.password);

    // Enforce unique customer email
    const existing = await customerRepository.findCustomerByEmail(email);
    if (existing) {
      throw new Error('An account with this email address already exists. Please sign in instead.');
    }

    const passwordHash = await this.hashPassword(input.password);
    const customerId = crypto.randomUUID();

    const customer = await customerRepository.createCustomer({
      id: customerId,
      email,
      passwordHash,
      name,
      phone: input.phone?.trim() || null,
    });

    // Automatically link any past guest orders matching this email
    await customerRepository.linkGuestOrdersByEmail(customer.id, customer.email);

    // Create persistent server-side session
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_TTL_DAYS);

    await customerRepository.createSession({
      id: crypto.randomUUID(),
      customerId: customer.id,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      customer: this.formatCustomerDTO(customer),
      token: rawToken,
    };
  }

  /**
   * Authenticates customer, links guest orders, issues session
   */
  public async login(input: LoginCustomerInput): Promise<{ customer: CustomerDTO; token: string }> {
    const email = (input.email || '').trim().toLowerCase();
    const password = input.password || '';

    if (!email || !password) {
      throw new Error('Invalid email or password.');
    }

    const customer = await customerRepository.findCustomerByEmail(email);
    if (!customer || customer.status !== 'active') {
      // Generic error message to prevent account enumeration
      throw new Error('Invalid email or password.');
    }

    const isMatch = await this.verifyPassword(password, customer.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    // Update last login timestamp
    await customerRepository.updateCustomerLastLogin(customer.id);

    // Link any newly placed or matching guest orders with this email
    await customerRepository.linkGuestOrdersByEmail(customer.id, customer.email);

    // Create session
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_TTL_DAYS);

    await customerRepository.createSession({
      id: crypto.randomUUID(),
      customerId: customer.id,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      customer: this.formatCustomerDTO(customer),
      token: rawToken,
    };
  }

  /**
   * Validates raw session token against customer_sessions
   */
  public async validateToken(rawToken: string): Promise<CustomerRecord | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = this.hashToken(rawToken);
    const session = await customerRepository.findSessionByTokenHash(tokenHash);

    if (!session) return null;

    // Check expiration
    const expiry = new Date(session.expires_at).getTime();
    if (Date.now() > expiry) {
      await customerRepository.deleteSessionByTokenHash(tokenHash);
      return null;
    }

    const customer = await customerRepository.findCustomerById(session.customer_id);
    if (!customer || customer.status !== 'active') {
      return null;
    }

    // Update session last_used_at
    await customerRepository.updateSessionLastUsed(session.id);

    return customer;
  }

  /**
   * Logs customer out by deleting current session
   */
  public async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await customerRepository.deleteSessionByTokenHash(tokenHash);
  }
}

export const customerAuthService = new CustomerAuthService();
