import { getDatabase, closeDatabase } from '../src/database/index.js';
import { catalogService } from '../src/services/catalog.service.js';
import crypto from 'crypto';

/**
 * Initial inventory seed script for CocoCraft Checkpoint 7.
 *
 * Assumptions:
 * 1. Strapi is the product master; this script queries active products from Strapi.
 * 2. Standard sustainable artisan items receive a baseline stock assumption of 20-30 units (default 24).
 * 3. Products flagged in Strapi catalog with 'low_stock' status receive 4 units (below threshold of 5).
 * 4. Products flagged in Strapi catalog with 'out_of_stock' status receive 0 units.
 * 5. Low stock alert threshold is set to 5 units.
 * 6. The script is idempotent: running it multiple times will only seed products missing from `inventory_items`.
 */
async function seedInventory() {
  console.log('🌿 [CocoCraft Inventory Seed] Connecting to database...');
  const db = getDatabase();

  console.log('📦 [CocoCraft Inventory Seed] Fetching products from Strapi catalog...');
  const products = await catalogService.getProducts();

  if (!products || products.length === 0) {
    console.error('❌ No products found in Strapi catalog. Ensure Strapi is running on port 1337.');
    process.exit(1);
  }

  console.log(`✨ Found ${products.length} products in Strapi catalog. Processing inventory records...`);

  let seededCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    const documentId = product.documentId;
    const sku = product.sku || `CC-${product.slug.toUpperCase().slice(0, 8)}`;

    // Check if item already exists in inventory_items
    const existing = db
      .prepare('SELECT id, product_reference, sku, available_quantity FROM inventory_items WHERE product_reference = ? OR sku = ?')
      .get(documentId, sku) as { id: string; available_quantity: number } | undefined;

    if (existing) {
      console.log(`⏩ [Skipped] Product "${product.name}" (${sku}) already exists with ${existing.available_quantity} available units.`);
      skippedCount++;
      continue;
    }

    // Determine initial stock based on catalog stock status
    let initialQty = 24;
    if (product.stockStatus === 'low_stock') {
      initialQty = 4;
    } else if (product.stockStatus === 'out_of_stock') {
      initialQty = 0;
    } else if (product.isFeatured) {
      initialQty = 18;
    }

    const lowStockThreshold = 5;
    const status = initialQty > 0 ? 'active' : 'out_of_stock';
    const itemId = crypto.randomUUID();
    const movementId = crypto.randomUUID();

    const seedTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO inventory_items (
          id, product_reference, sku, available_quantity, reserved_quantity,
          sold_quantity, low_stock_threshold, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(itemId, documentId, sku, initialQty, lowStockThreshold, status);

      db.prepare(`
        INSERT INTO inventory_movements (
          id, product_reference, movement_type, quantity, previous_quantity,
          new_quantity, reference_type, reference_id, admin_user_id, note, created_at
        ) VALUES (?, ?, 'INITIAL_STOCK', ?, 0, ?, 'initial_seed', ?, NULL, ?, CURRENT_TIMESTAMP)
      `).run(
        movementId,
        documentId,
        initialQty,
        initialQty,
        itemId,
        `Initial artisan catalog seed: ${product.name} (${sku})`
      );
    });

    seedTx();
    console.log(`✅ [Seeded] "${product.name}" (${sku}) -> ${initialQty} units (Status: ${status})`);
    seededCount++;
  }

  console.log('\n============================================================');
  console.log(`🎉 Inventory Seeding Complete!`);
  console.log(`   Total Products Checked: ${products.length}`);
  console.log(`   New Records Seeded:     ${seededCount}`);
  console.log(`   Existing Skipped:       ${skippedCount}`);
  console.log('============================================================\n');

  closeDatabase();
}

seedInventory().catch((err) => {
  console.error('❌ Failed to seed inventory:', err);
  process.exit(1);
});
