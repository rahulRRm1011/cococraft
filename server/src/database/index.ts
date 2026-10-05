import Database, { Database as DatabaseInstance } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

let dbInstance: DatabaseInstance | null = null;

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    const dbFilePath = path.isAbsolute(config.databasePath)
      ? config.databasePath
      : path.resolve(process.cwd(), config.databasePath);

    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = new Database(dbFilePath);
    // Enable WAL mode for better concurrency and write performance
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');

    initSchema(dbInstance);
  }

  return dbInstance;
}

function initSchema(db: DatabaseInstance): void {
  // Initialize foundational tables for transactional workflows (carts, cart_items, orders, customer data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO system_metadata (key, value)
    VALUES ('db_initialized', 'true');

    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_document_id TEXT NOT NULL,
      product_slug TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 99),
      unit_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cart_id, product_document_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
    CREATE INDEX IF NOT EXISTS idx_cart_items_slug ON cart_items(product_slug);

    -- Sequence generator for unique order numbers
    CREATE TABLE IF NOT EXISTS order_sequences (
      name TEXT PRIMARY KEY,
      current_val INTEGER NOT NULL
    );

    -- Orders table for customer checkouts
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      cart_id TEXT REFERENCES carts(id),
      idempotency_key TEXT UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address_line1 TEXT NOT NULL,
      delivery_address_line2 TEXT,
      delivery_city TEXT NOT NULL,
      delivery_state TEXT NOT NULL,
      delivery_postal_code TEXT NOT NULL,
      delivery_country TEXT NOT NULL DEFAULT 'India',
      subtotal_paise INTEGER NOT NULL,
      shipping_paise INTEGER NOT NULL,
      discount_paise INTEGER NOT NULL DEFAULT 0,
      tax_paise INTEGER NOT NULL DEFAULT 0,
      grand_total_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      order_status TEXT NOT NULL DEFAULT 'confirmed',
      customer_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_access_token ON orders(access_token);

    -- Order items snapshot table (immutable historical record)
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_document_id TEXT NOT NULL,
      product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_image_url TEXT,
      quantity INTEGER NOT NULL CHECK (quantity >= 1),
      unit_price_paise INTEGER NOT NULL,
      line_total_paise INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

    -- Payments table for payment attempts and audit trail
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      payment_reference TEXT UNIQUE NOT NULL,
      provider TEXT NOT NULL DEFAULT 'cococraft_mock',
      method TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'created',
      attempt_number INTEGER NOT NULL DEFAULT 1,
      idempotency_key TEXT UNIQUE,
      provider_reference TEXT,
      failure_code TEXT,
      failure_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_reference ON payments(payment_reference);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

    -- Secure guest order sessions (HttpOnly cookie authorization)
    CREATE TABLE IF NOT EXISTS guest_order_sessions (
      session_token TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guest_order_sessions_order_id ON guest_order_sessions(order_id);

    -- Admin users table
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
    CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

    -- Admin session management (token hash storage)
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON admin_sessions(admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

    -- Order lifecycle and operational audit events table
    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at);

    -- Additional performance and search indexes for operational queries
    CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

    -- Inventory Control Layer
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      product_reference TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_product_ref ON inventory_items(product_reference);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
    CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);

    -- Stock Movement Audit Trail
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_reference TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_ref ON inventory_movements(product_reference);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);

    -- Stock Reservations (concurrency & overselling protection)
    CREATE TABLE IF NOT EXISTS stock_reservations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_reference TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1),
      status TEXT NOT NULL DEFAULT 'reserved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);
    CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_ref ON stock_reservations(product_reference);
    CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status);

    -- Customer Accounts Layer (Checkpoint 8)
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

    -- Customer Sessions Layer (HttpOnly secure session cookies)
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_sessions_token_hash ON customer_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions(expires_at);

    -- Customer Saved Address Book
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line_1 TEXT NOT NULL,
      address_line_2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

    -- ==========================================
    -- CHECKPOINT 9: ENGAGEMENT & RETENTION LAYER
    -- ==========================================

    -- Product Reviews & Ratings (Verified Buyers)
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_reference TEXT NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product_ref ON reviews(product_reference);
    CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_customer_order_product ON reviews(customer_id, order_id, product_reference);

    -- Wishlist Items
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_reference TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_wishlist_customer_id ON wishlist_items(customer_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_customer_product ON wishlist_items(customer_id, product_reference);

    -- Loyalty Accounts (Points Ledger)
    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
      points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
      total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
      total_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Loyalty Transactions History
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      transaction_type TEXT NOT NULL,
      points INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer_id ON loyalty_transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_ref ON loyalty_transactions(reference_type, reference_id);

    -- Discount & Promotional Coupons
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value INTEGER NOT NULL CHECK (discount_value > 0),
      minimum_order_amount INTEGER NOT NULL DEFAULT 0,
      maximum_discount INTEGER,
      start_date DATETIME,
      expiry_date DATETIME,
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
    CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);

    -- Internal Customer Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'general',
      is_read INTEGER NOT NULL DEFAULT 0,
      reference_type TEXT,
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(customer_id, is_read);

    -- Customer Engagement Activity Stream
    CREATE TABLE IF NOT EXISTS customer_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      reference_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customer_events_customer_id ON customer_events(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_events_type ON customer_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_customer_events_created_at ON customer_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_order_items_product_slug ON order_items(product_slug);
  `);

  // Migration: Ensure orders table has customer_id column
  const orderColumns = db.pragma('table_info(orders)') as Array<{ name: string }>;
  const hasCustomerId = orderColumns.some((col) => col.name === 'customer_id');
  if (!hasCustomerId) {
    db.exec(`ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`);

  // Migration: Ensure orders table has coupon_code column
  const hasCouponCode = orderColumns.some((col) => col.name === 'coupon_code');
  if (!hasCouponCode) {
    db.exec(`ALTER TABLE orders ADD COLUMN coupon_code TEXT;`);
  }

  // Seed default demonstration coupons if empty
  const couponCountRow = db.prepare('SELECT COUNT(*) as count FROM coupons').get() as { count: number };
  if (couponCountRow.count === 0) {
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (id, code, discount_type, discount_value, minimum_order_amount, maximum_discount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);
    insertCoupon.run('cpn_welcome10', 'WELCOME10', 'percentage', 10, 500, 200);
    insertCoupon.run('cpn_artisan50', 'ARTISAN50', 'fixed', 50, 400, 50);
    insertCoupon.run('cpn_cocofest15', 'COCOFEST15', 'percentage', 15, 800, 300);
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
