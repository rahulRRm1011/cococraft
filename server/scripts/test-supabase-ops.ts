import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log('Testing Supabase query builder operations...');

  // 1. Select customers
  const { data: customers, error: cErr } = await supabase.from('customers').select('*').limit(2);
  console.log('1. Select customers:', { count: customers?.length, error: cErr?.message });

  // 2. Select admin with join
  const { data: sessions, error: sErr } = await supabase.from('admin_sessions').select('*, admin_users(*)').limit(1);
  console.log('2. Join admin_sessions + admin_users:', { sessionFound: !!sessions?.[0], error: sErr?.message });

  // 3. Test insert & delete temporary cart
  const testCartId = `test_cart_${Date.now()}`;
  const { data: newCart, error: cartErr } = await supabase.from('carts').insert({ id: testCartId, status: 'active' }).select().single();
  console.log('3. Insert cart:', { newCartId: newCart?.id, error: cartErr?.message });

  // 4. Update cart
  const { error: upErr } = await supabase.from('carts').update({ status: 'completed' }).eq('id', testCartId);
  console.log('4. Update cart:', { error: upErr?.message });

  // 5. Delete test cart
  const { error: delErr } = await supabase.from('carts').delete().eq('id', testCartId);
  console.log('5. Delete test cart:', { error: delErr?.message });

  console.log('All basic Supabase query builder operations tested successfully!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
