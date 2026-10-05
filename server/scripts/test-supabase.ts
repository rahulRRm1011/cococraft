import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

console.log('Testing Supabase URL:', url);
if (!url || !key) {
  console.error('Missing URL or key');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  const tables = [
    'system_metadata', 'order_sequences', 'admin_users', 'admin_sessions',
    'customers', 'customer_sessions', 'customer_addresses', 'customer_events',
    'carts', 'cart_items', 'orders', 'order_items', 'order_events',
    'guest_order_sessions', 'payments', 'inventory_items', 'inventory_movements',
    'stock_reservations', 'reviews', 'wishlist_items', 'loyalty_accounts',
    'loyalty_transactions', 'coupons', 'notifications'
  ];

  console.log('Checking tables in Supabase...');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table [${t}]: NOT FOUND or error:`, error.message);
    } else {
      console.log(`Table [${t}]: EXISTS (${count} rows)`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
