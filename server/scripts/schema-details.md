### Table: `admin_sessions` (6 rows)
Original SQL:
```sql
CREATE TABLE admin_sessions (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `admin_user_id` (`TEXT`) NOT NULL
- `token_hash` (`TEXT`) NOT NULL
- `expires_at` (`DATETIME`) NOT NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `last_used_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `admin_user_id` -> `admin_users(id)` ON DELETE CASCADE
Indexes:
- `idx_admin_sessions_expires_at` (`expires_at`)
- `idx_admin_sessions_admin_user_id` (`admin_user_id`)
- `idx_admin_sessions_token_hash` (`token_hash`) **UNIQUE**

---

### Table: `admin_users` (13 rows)
Original SQL:
```sql
CREATE TABLE admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `email` (`TEXT`) NOT NULL
- `password_hash` (`TEXT`) NOT NULL
- `display_name` (`TEXT`) NOT NULL
- `role` (`TEXT`) NOT NULL DEFAULT `'admin'`
- `is_active` (`INTEGER`) NOT NULL DEFAULT `1`
- `last_login_at` (`DATETIME`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Indexes:
- `idx_admin_users_role` (`role`)
- `idx_admin_users_email` (`email`) **UNIQUE**

---

### Table: `cart_items` (7 rows)
Original SQL:
```sql
CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_document_id TEXT NOT NULL,
      product_slug TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 99),
      unit_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cart_id, product_document_id)
    )
```

Columns:
- `id` (`INTEGER`) **PRIMARY KEY** NULL
- `cart_id` (`TEXT`) NOT NULL
- `product_document_id` (`TEXT`) NOT NULL
- `product_slug` (`TEXT`) NOT NULL
- `quantity` (`INTEGER`) NOT NULL
- `unit_price` (`REAL`) NOT NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `cart_id` -> `carts(id)` ON DELETE CASCADE
Indexes:
- `idx_cart_items_slug` (`product_slug`)
- `idx_cart_items_cart_id` (`cart_id`)

---

### Table: `carts` (48 rows)
Original SQL:
```sql
CREATE TABLE carts (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `status` (`TEXT`) NOT NULL DEFAULT `'active'`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`

---

### Table: `coupons` (9 rows)
Original SQL:
```sql
CREATE TABLE coupons (
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
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `code` (`TEXT`) NOT NULL
- `discount_type` (`TEXT`) NOT NULL
- `discount_value` (`INTEGER`) NOT NULL
- `minimum_order_amount` (`INTEGER`) NOT NULL DEFAULT `0`
- `maximum_discount` (`INTEGER`) NULL
- `start_date` (`DATETIME`) NULL
- `expiry_date` (`DATETIME`) NULL
- `usage_limit` (`INTEGER`) NULL
- `used_count` (`INTEGER`) NOT NULL DEFAULT `0`
- `status` (`TEXT`) NOT NULL DEFAULT `'active'`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Indexes:
- `idx_coupons_status` (`status`)
- `idx_coupons_code` (`code`) **UNIQUE**

---

### Table: `customer_addresses` (3 rows)
Original SQL:
```sql
CREATE TABLE customer_addresses (
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
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NOT NULL
- `name` (`TEXT`) NOT NULL
- `phone` (`TEXT`) NOT NULL
- `address_line_1` (`TEXT`) NOT NULL
- `address_line_2` (`TEXT`) NULL
- `city` (`TEXT`) NOT NULL
- `state` (`TEXT`) NOT NULL
- `postal_code` (`TEXT`) NOT NULL
- `country` (`TEXT`) NOT NULL DEFAULT `'India'`
- `is_default` (`INTEGER`) NOT NULL DEFAULT `0`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE CASCADE
Indexes:
- `idx_customer_addresses_customer_id` (`customer_id`)

---

### Table: `customer_events` (60 rows)
Original SQL:
```sql
CREATE TABLE customer_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      reference_id TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NULL
- `event_type` (`TEXT`) NOT NULL
- `reference_id` (`TEXT`) NULL
- `metadata` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE SET NULL
Indexes:
- `idx_customer_events_created_at` (`created_at`)
- `idx_customer_events_type` (`event_type`)
- `idx_customer_events_customer_id` (`customer_id`)

---

### Table: `customer_sessions` (9 rows)
Original SQL:
```sql
CREATE TABLE customer_sessions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NOT NULL
- `token_hash` (`TEXT`) NOT NULL
- `expires_at` (`DATETIME`) NOT NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `last_used_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE CASCADE
Indexes:
- `idx_customer_sessions_expires_at` (`expires_at`)
- `idx_customer_sessions_customer_id` (`customer_id`)
- `idx_customer_sessions_token_hash` (`token_hash`) **UNIQUE**

---

### Table: `customers` (9 rows)
Original SQL:
```sql
CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `email` (`TEXT`) NOT NULL
- `password_hash` (`TEXT`) NOT NULL
- `name` (`TEXT`) NOT NULL
- `phone` (`TEXT`) NULL
- `status` (`TEXT`) NOT NULL DEFAULT `'active'`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `last_login_at` (`DATETIME`) NULL
Indexes:
- `idx_customers_status` (`status`)
- `idx_customers_email` (`email`) **UNIQUE**

---

### Table: `guest_order_sessions` (33 rows)
Original SQL:
```sql
CREATE TABLE guest_order_sessions (
      session_token TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
```

Columns:
- `session_token` (`TEXT`) **PRIMARY KEY** NULL
- `order_id` (`TEXT`) NOT NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `expires_at` (`DATETIME`) NOT NULL
Foreign Keys:
- `order_id` -> `orders(id)` ON DELETE CASCADE
Indexes:
- `idx_guest_order_sessions_order_id` (`order_id`)

---

### Table: `inventory_items` (29 rows)
Original SQL:
```sql
CREATE TABLE inventory_items (
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
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `product_reference` (`TEXT`) NOT NULL
- `sku` (`TEXT`) NOT NULL
- `available_quantity` (`INTEGER`) NOT NULL DEFAULT `0`
- `reserved_quantity` (`INTEGER`) NOT NULL DEFAULT `0`
- `sold_quantity` (`INTEGER`) NOT NULL DEFAULT `0`
- `low_stock_threshold` (`INTEGER`) NOT NULL DEFAULT `5`
- `status` (`TEXT`) NOT NULL DEFAULT `'active'`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Indexes:
- `idx_inventory_items_status` (`status`)
- `idx_inventory_items_sku` (`sku`) **UNIQUE**
- `idx_inventory_items_product_ref` (`product_reference`) **UNIQUE**

---

### Table: `inventory_movements` (114 rows)
Original SQL:
```sql
CREATE TABLE inventory_movements (
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
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `product_reference` (`TEXT`) NOT NULL
- `movement_type` (`TEXT`) NOT NULL
- `quantity` (`INTEGER`) NOT NULL
- `previous_quantity` (`INTEGER`) NOT NULL
- `new_quantity` (`INTEGER`) NOT NULL
- `reference_type` (`TEXT`) NULL
- `reference_id` (`TEXT`) NULL
- `admin_user_id` (`TEXT`) NULL
- `note` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `admin_user_id` -> `admin_users(id)` ON DELETE SET NULL
Indexes:
- `idx_inventory_movements_type` (`movement_type`)
- `idx_inventory_movements_created_at` (`created_at`)
- `idx_inventory_movements_product_ref` (`product_reference`)

---

### Table: `loyalty_accounts` (0 rows)
Original SQL:
```sql
CREATE TABLE loyalty_accounts (
      customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
      points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
      total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
      total_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `customer_id` (`TEXT`) **PRIMARY KEY** NULL
- `points_balance` (`INTEGER`) NOT NULL DEFAULT `0`
- `total_earned` (`INTEGER`) NOT NULL DEFAULT `0`
- `total_redeemed` (`INTEGER`) NOT NULL DEFAULT `0`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE CASCADE

---

### Table: `loyalty_transactions` (0 rows)
Original SQL:
```sql
CREATE TABLE loyalty_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      transaction_type TEXT NOT NULL,
      points INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NOT NULL
- `transaction_type` (`TEXT`) NOT NULL
- `points` (`INTEGER`) NOT NULL
- `reference_type` (`TEXT`) NULL
- `reference_id` (`TEXT`) NULL
- `description` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE CASCADE
Indexes:
- `idx_loyalty_tx_ref` (`reference_type`, `reference_id`)
- `idx_loyalty_tx_customer_id` (`customer_id`)

---

### Table: `notifications` (4 rows)
Original SQL:
```sql
CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'general',
      is_read INTEGER NOT NULL DEFAULT 0,
      reference_type TEXT,
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NOT NULL
- `title` (`TEXT`) NOT NULL
- `message` (`TEXT`) NOT NULL
- `type` (`TEXT`) NOT NULL DEFAULT `'general'`
- `is_read` (`INTEGER`) NOT NULL DEFAULT `0`
- `reference_type` (`TEXT`) NULL
- `reference_id` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE CASCADE
Indexes:
- `idx_notifications_is_read` (`customer_id`, `is_read`)
- `idx_notifications_customer_id` (`customer_id`)

---

### Table: `order_events` (22 rows)
Original SQL:
```sql
CREATE TABLE order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `order_id` (`TEXT`) NOT NULL
- `event_type` (`TEXT`) NOT NULL
- `from_status` (`TEXT`) NULL
- `to_status` (`TEXT`) NULL
- `admin_user_id` (`TEXT`) NULL
- `note` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `admin_user_id` -> `admin_users(id)` ON DELETE SET NULL
- `order_id` -> `orders(id)` ON DELETE CASCADE
Indexes:
- `idx_order_events_created_at` (`created_at`)
- `idx_order_events_order_id` (`order_id`)

---

### Table: `order_items` (57 rows)
Original SQL:
```sql
CREATE TABLE order_items (
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
    )
```

Columns:
- `id` (`INTEGER`) **PRIMARY KEY** NULL
- `order_id` (`TEXT`) NOT NULL
- `product_document_id` (`TEXT`) NOT NULL
- `product_slug` (`TEXT`) NOT NULL
- `product_name` (`TEXT`) NOT NULL
- `sku` (`TEXT`) NOT NULL
- `product_image_url` (`TEXT`) NULL
- `quantity` (`INTEGER`) NOT NULL
- `unit_price_paise` (`INTEGER`) NOT NULL
- `line_total_paise` (`INTEGER`) NOT NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `order_id` -> `orders(id)` ON DELETE CASCADE
Indexes:
- `idx_order_items_product_slug` (`product_slug`)
- `idx_order_items_order_id` (`order_id`)

---

### Table: `order_sequences` (2 rows)
Original SQL:
```sql
CREATE TABLE order_sequences (
      name TEXT PRIMARY KEY,
      current_val INTEGER NOT NULL
    )
```

Columns:
- `name` (`TEXT`) **PRIMARY KEY** NULL
- `current_val` (`INTEGER`) NOT NULL

---

### Table: `orders` (77 rows)
Original SQL:
```sql
CREATE TABLE orders (
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
    , customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL, coupon_code TEXT)
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `order_number` (`TEXT`) NOT NULL
- `access_token` (`TEXT`) NOT NULL
- `cart_id` (`TEXT`) NULL
- `idempotency_key` (`TEXT`) NULL
- `customer_name` (`TEXT`) NOT NULL
- `customer_email` (`TEXT`) NOT NULL
- `customer_phone` (`TEXT`) NOT NULL
- `delivery_address_line1` (`TEXT`) NOT NULL
- `delivery_address_line2` (`TEXT`) NULL
- `delivery_city` (`TEXT`) NOT NULL
- `delivery_state` (`TEXT`) NOT NULL
- `delivery_postal_code` (`TEXT`) NOT NULL
- `delivery_country` (`TEXT`) NOT NULL DEFAULT `'India'`
- `subtotal_paise` (`INTEGER`) NOT NULL
- `shipping_paise` (`INTEGER`) NOT NULL
- `discount_paise` (`INTEGER`) NOT NULL DEFAULT `0`
- `tax_paise` (`INTEGER`) NOT NULL DEFAULT `0`
- `grand_total_paise` (`INTEGER`) NOT NULL
- `currency` (`TEXT`) NOT NULL DEFAULT `'INR'`
- `payment_method` (`TEXT`) NOT NULL DEFAULT `'cod'`
- `payment_status` (`TEXT`) NOT NULL DEFAULT `'unpaid'`
- `order_status` (`TEXT`) NOT NULL DEFAULT `'confirmed'`
- `customer_note` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `customer_id` (`TEXT`) NULL
- `coupon_code` (`TEXT`) NULL
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE SET NULL
- `cart_id` -> `carts(id)` ON DELETE NO ACTION
Indexes:
- `idx_orders_status` (`order_status`)
- `idx_orders_customer_id` (`customer_id`)
- `idx_orders_customer_name` (`customer_name`)
- `idx_orders_customer_email` (`customer_email`)
- `idx_orders_payment_status` (`payment_status`)
- `idx_orders_order_status` (`order_status`)
- `idx_orders_access_token` (`access_token`)
- `idx_orders_created_at` (`created_at`)
- `idx_orders_idempotency_key` (`idempotency_key`) **UNIQUE**
- `idx_orders_order_number` (`order_number`) **UNIQUE**

---

### Table: `payments` (41 rows)
Original SQL:
```sql
CREATE TABLE payments (
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
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `order_id` (`TEXT`) NOT NULL
- `payment_reference` (`TEXT`) NOT NULL
- `provider` (`TEXT`) NOT NULL DEFAULT `'cococraft_mock'`
- `method` (`TEXT`) NOT NULL
- `amount_paise` (`INTEGER`) NOT NULL
- `currency` (`TEXT`) NOT NULL DEFAULT `'INR'`
- `status` (`TEXT`) NOT NULL DEFAULT `'created'`
- `attempt_number` (`INTEGER`) NOT NULL DEFAULT `1`
- `idempotency_key` (`TEXT`) NULL
- `provider_reference` (`TEXT`) NULL
- `failure_code` (`TEXT`) NULL
- `failure_message` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `completed_at` (`DATETIME`) NULL
Foreign Keys:
- `order_id` -> `orders(id)` ON DELETE CASCADE
Indexes:
- `idx_payments_created_at` (`created_at`)
- `idx_payments_idempotency_key` (`idempotency_key`) **UNIQUE**
- `idx_payments_status` (`status`)
- `idx_payments_payment_reference` (`payment_reference`) **UNIQUE**
- `idx_payments_order_id` (`order_id`)

---

### Table: `reviews` (4 rows)
Original SQL:
```sql
CREATE TABLE reviews (
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
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NOT NULL
- `product_reference` (`TEXT`) NOT NULL
- `order_id` (`TEXT`) NOT NULL
- `rating` (`INTEGER`) NOT NULL
- `title` (`TEXT`) NOT NULL
- `comment` (`TEXT`) NOT NULL
- `status` (`TEXT`) NOT NULL DEFAULT `'pending'`
- `customer_name` (`TEXT`) NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `order_id` -> `orders(id)` ON DELETE CASCADE
- `customer_id` -> `customers(id)` ON DELETE CASCADE
Indexes:
- `idx_reviews_customer_order_product` (`customer_id`, `order_id`, `product_reference`) **UNIQUE**
- `idx_reviews_status` (`status`)
- `idx_reviews_customer_id` (`customer_id`)
- `idx_reviews_product_ref` (`product_reference`)

---

### Table: `stock_reservations` (24 rows)
Original SQL:
```sql
CREATE TABLE stock_reservations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_reference TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1),
      status TEXT NOT NULL DEFAULT 'reserved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `order_id` (`TEXT`) NOT NULL
- `product_reference` (`TEXT`) NOT NULL
- `quantity` (`INTEGER`) NOT NULL
- `status` (`TEXT`) NOT NULL DEFAULT `'reserved'`
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
- `released_at` (`DATETIME`) NULL
Foreign Keys:
- `order_id` -> `orders(id)` ON DELETE CASCADE
Indexes:
- `idx_stock_reservations_status` (`status`)
- `idx_stock_reservations_product_ref` (`product_reference`)
- `idx_stock_reservations_order_id` (`order_id`)

---

### Table: `system_metadata` (1 rows)
Original SQL:
```sql
CREATE TABLE system_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `key` (`TEXT`) **PRIMARY KEY** NULL
- `value` (`TEXT`) NOT NULL
- `updated_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`

---

### Table: `wishlist_items` (6 rows)
Original SQL:
```sql
CREATE TABLE wishlist_items (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_reference TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
```

Columns:
- `id` (`TEXT`) **PRIMARY KEY** NULL
- `customer_id` (`TEXT`) NOT NULL
- `product_reference` (`TEXT`) NOT NULL
- `created_at` (`DATETIME`) NULL DEFAULT `CURRENT_TIMESTAMP`
Foreign Keys:
- `customer_id` -> `customers(id)` ON DELETE CASCADE
Indexes:
- `idx_wishlist_customer_product` (`customer_id`, `product_reference`) **UNIQUE**
- `idx_wishlist_customer_id` (`customer_id`)

---
