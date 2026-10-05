import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const sqliteDbPath = path.resolve(process.cwd(), 'data', 'cococraft.db');

if (!fs.existsSync(sqliteDbPath)) {
  console.error(`❌ SQLite database file not found at: ${sqliteDbPath}`);
  process.exit(1);
}

const sqlite = new Database(sqliteDbPath, { readonly: true });

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl && (!supabaseUrl || !supabaseServiceKey)) {
  console.error(`❌ Missing Supabase credentials in environment.`);
  console.error(`Please provide either:`);
  console.error(`  - DATABASE_URL (Direct PostgreSQL connection string from Supabase Settings -> Database)`);
  console.error(`  - OR SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API)`);
  process.exit(1);
}

// Ordered table list to respect foreign key constraints
const migrationOrder = [
  'system_metadata',
  'order_sequences',
  'admin_users',
  'admin_sessions',
  'customers',
  'customer_sessions',
  'customer_addresses',
  'customer_events',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'order_events',
  'guest_order_sessions',
  'payments',
  'inventory_items',
  'inventory_movements',
  'stock_reservations',
  'reviews',
  'wishlist_items',
  'loyalty_accounts',
  'loyalty_transactions',
  'coupons',
  'notifications',
];

interface TableMigrationResult {
  table: string;
  sqliteRows: number;
  supabaseRows: number;
  result: 'PASS' | 'FAIL';
  error?: string;
}

async function migrateViaPg(connectionString: string): Promise<TableMigrationResult[]> {
  console.log(`🔌 Connecting to Supabase PostgreSQL via connection pool...`);
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  const client = await pool.connect();
  const results: TableMigrationResult[] = [];

  try {
    console.log(`✅ Connected successfully to PostgreSQL.`);
    console.log(`🚀 Beginning data migration for ${migrationOrder.length} tables...\n`);

    for (const tableName of migrationOrder) {
      const sqliteRows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all() as any[];
      const sqliteCount = sqliteRows.length;

      try {
        if (sqliteCount > 0) {
          const sampleRow = sqliteRows[0];
          const columns = Object.keys(sampleRow);
          const colList = columns.map((c) => `"${c}"`).join(', ');

          for (const row of sqliteRows) {
            const values = columns.map((c) => row[c]);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            // Use ON CONFLICT DO NOTHING to avoid duplicate key errors on re-runs
            const insertSql = `
              INSERT INTO "${tableName}" (${colList})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING;
            `;

            await client.query(insertSql, values);
          }
        }

        // Reset sequence for auto-incrementing identity tables if applicable
        if (tableName === 'cart_items' || tableName === 'order_items') {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), coalesce(max(id), 1))
            FROM "${tableName}";
          `).catch(() => {});
        }

        // Verify count
        const countRes = await client.query(`SELECT COUNT(*)::int as count FROM "${tableName}"`);
        const pgCount = countRes.rows[0].count;

        results.push({
          table: tableName,
          sqliteRows: sqliteCount,
          supabaseRows: pgCount,
          result: pgCount >= sqliteCount ? 'PASS' : 'FAIL',
        });

        console.log(`  ✓ Migrated [${tableName}]: ${sqliteCount} SQLite rows -> ${pgCount} Supabase rows`);
      } catch (err: any) {
        console.error(`  ✗ Error migrating [${tableName}]:`, err.message);
        results.push({
          table: tableName,
          sqliteRows: sqliteCount,
          supabaseRows: 0,
          result: 'FAIL',
          error: err.message,
        });
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  return results;
}

async function migrateViaSupabaseClient(url: string, key: string): Promise<TableMigrationResult[]> {
  console.log(`🔌 Connecting to Supabase via REST Client (@supabase/supabase-js)...`);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: TableMigrationResult[] = [];

  for (const tableName of migrationOrder) {
    const sqliteRows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all() as any[];
    const sqliteCount = sqliteRows.length;

    try {
      if (sqliteCount > 0) {
        // Chunk inserts into batches of 100
        const chunkSize = 100;
        for (let i = 0; i < sqliteRows.length; i += chunkSize) {
          const chunk = sqliteRows.slice(i, i + chunkSize);
          const { error } = await supabase
            .from(tableName)
            .upsert(chunk, { ignoreDuplicates: true });

          if (error) {
            throw error;
          }
        }
      }

      // Count rows
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      const pgCount = count || 0;
      results.push({
        table: tableName,
        sqliteRows: sqliteCount,
        supabaseRows: pgCount,
        result: pgCount >= sqliteCount ? 'PASS' : 'FAIL',
      });

      console.log(`  ✓ Migrated [${tableName}]: ${sqliteCount} SQLite rows -> ${pgCount} Supabase rows`);
    } catch (err: any) {
      console.error(`  ✗ Error migrating [${tableName}]:`, err.message);
      results.push({
        table: tableName,
        sqliteRows: sqliteCount,
        supabaseRows: 0,
        result: 'FAIL',
        error: err.message,
      });
    }
  }

  return results;
}

async function main() {
  console.log('====================================================');
  console.log('🥥 COCOCRAFT: SQLITE -> SUPABASE POSTGRESQL MIGRATION');
  console.log('====================================================\n');
  console.log(`📁 Source SQLite DB: ${sqliteDbPath}`);

  let results: TableMigrationResult[] = [];

  const startTime = Date.now();

  if (databaseUrl) {
    results = await migrateViaPg(databaseUrl);
  } else if (supabaseUrl && supabaseServiceKey) {
    results = await migrateViaSupabaseClient(supabaseUrl, supabaseServiceKey);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n====================================================');
  console.log('📊 MIGRATION VERIFICATION TABLE');
  console.log('====================================================\n');
  console.log('| Table | SQLite Rows | Supabase Rows | Result |');
  console.log('|:---|---:|---:|:---|');

  let allPassed = true;
  for (const r of results) {
    console.log(`| ${r.table} | ${r.sqliteRows} | ${r.supabaseRows} | ${r.result === 'PASS' ? '✅ PASS' : '❌ FAIL'} |`);
    if (r.result !== 'PASS') {
      allPassed = false;
    }
  }

  console.log(`\nCompleted in ${durationSec}s.`);

  if (allPassed) {
    console.log('\n🎉 ALL TABLES SUCCESSFULLY MIGRATED & VERIFIED!');
  } else {
    console.log('\n⚠️ Some tables had migration discrepancies. See errors above.');
  }

  sqlite.close();
}

main().catch((err) => {
  console.error('Fatal migration failure:', err);
  process.exit(1);
});
