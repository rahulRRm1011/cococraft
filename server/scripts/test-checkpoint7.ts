import crypto from 'crypto';
import { getDatabase } from '../src/database/index.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { adminAuthService } from '../src/services/adminAuth.service.js';
import { cartService } from '../src/services/cart.service.js';
import { orderService } from '../src/services/order.service.js';
import { paymentService } from '../src/services/payment.service.js';
import { adminOrderService } from '../src/services/adminOrder.service.js';
import { catalogService } from '../src/services/catalog.service.js';

const db = getDatabase();
const BASE_URL = 'http://localhost:4000/api';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 ============================================================');
  console.log('🧪 COCOCRAFT CHECKPOINT 7 VERIFICATION SUITE');
  console.log('🧪 INVENTORY, RESERVATIONS, CONCURRENCY & ADMIN OPERATIONS');
  console.log('🧪 ============================================================\n');

  // --- 0. Admin Authentication Bootstrap ---
  console.log('--- 0. Bootstrapping Admin User for Operational Tests ---');
  const adminEmail = `inventory_tester_${Date.now()}@cococraft.com`;
  const adminPassword = 'AdminSecret@2026';
  await adminAuthService.createAdmin(adminEmail, adminPassword, 'Inventory Ops Lead', 'admin');
  const loginRes = await adminAuthService.login(adminEmail, adminPassword);
  const adminToken = loginRes.token;
  const adminId = loginRes.user.id;
  assert(Boolean(adminToken), 'Admin session authenticated');

  // --- 1. Product Availability API & Batch Mapping ---
  console.log('\n--- 1. Testing Product Availability API & Storefront Endpoints ---');
  const products = await catalogService.getProducts();
  assert(products.length > 0, `Catalog contains ${products.length} products`);

  const testProduct = products[0];
  const availRes = await fetch(`${BASE_URL}/inventory/product/${testProduct.documentId}`);
  const availJson = await availRes.json();
  assert(availRes.ok && availJson.success === true, 'Public inventory availability API succeeds');
  assert(typeof availJson.data.can_purchase === 'boolean', 'Response contains can_purchase flag');
  assert(['In Stock', 'Only a few pieces remaining', 'Out of Stock'].includes(availJson.data.display_message),
    `Display message is customer-friendly: "${availJson.data.display_message}"`
  );

  const batchRes = await fetch(`${BASE_URL}/inventory/availability`);
  const batchJson = await batchRes.json();
  assert(batchRes.ok && batchJson.success === true, 'Batch availability endpoint succeeds');
  assert(Boolean(batchJson.data[testProduct.documentId]), 'Batch map includes test product reference');

  // --- 2. Manual Stock Adjustments & Validation ---
  console.log('\n--- 2. Testing Manual Stock Adjustments & Thresholds ---');
  const testRef = `TEST-REF-${Date.now()}`;
  const testSku = `CC-TEST-${Math.floor(Math.random() * 1000)}`;

  // Seed baseline 100 units
  inventoryService.getRepository().upsertInitialStock(testRef, testSku, 100, 5);
  let item = inventoryService.getRepository().findByProductReference(testRef)!;
  assert(item.available_quantity === 100, 'Baseline item initialized at 100 units');

  // Add stock: 100 -> 120
  await inventoryService.manualAdjustStock(testRef, { action: 'add', quantity: 20, reason: 'Artisan shipment received' }, adminId);
  item = inventoryService.getRepository().findByProductReference(testRef)!;
  assert(item.available_quantity === 120, 'Stock added: 100 -> 120 units');

  // Remove stock: 120 -> 115
  await inventoryService.manualAdjustStock(testRef, { action: 'remove', quantity: 5, reason: 'Damaged in storage' }, adminId);
  item = inventoryService.getRepository().findByProductReference(testRef)!;
  assert(item.available_quantity === 115, 'Stock removed: 120 -> 115 units');

  // Cannot remove 200 (more than available)
  let removeExceeded = false;
  try {
    await inventoryService.manualAdjustStock(testRef, { action: 'remove', quantity: 200, reason: 'Invalid bulk removal' }, adminId);
  } catch (err: any) {
    removeExceeded = true;
    assert(err.message.includes('Cannot remove'), 'Cannot remove more stock than available units');
  }
  assert(removeExceeded, 'Excessive removal rejected properly');

  // Low stock threshold
  await inventoryService.manualAdjustStock(testRef, { action: 'remove', quantity: 111, reason: 'High demand dispatch' }, adminId);
  item = inventoryService.getRepository().findByProductReference(testRef)!;
  assert(item.available_quantity === 4, 'Stock reduced to 4 units');
  assert(item.availability === 'low_stock', 'Availability dynamically transitioned to low_stock (threshold 5)');

  // Out of stock
  await inventoryService.manualAdjustStock(testRef, { action: 'remove', quantity: 4, reason: 'Final batch sold' }, adminId);
  item = inventoryService.getRepository().findByProductReference(testRef)!;
  assert(item.available_quantity === 0, 'Stock reduced to 0 units');
  assert(item.availability === 'out_of_stock', 'Availability dynamically transitioned to out_of_stock');

  // --- 3. Cart Stock Validation ---
  console.log('\n--- 3. Testing Cart Stock Validation (Impossible Carts Rejected) ---');
  // Replenish test product to 3 sellable units
  await inventoryService.manualAdjustStock(testRef, { action: 'add', quantity: 3, reason: 'Small restock batch' }, adminId);
  item = inventoryService.getRepository().findByProductReference(testRef)!;
  assert(item.sellable_quantity === 3, 'Product sellable stock set to 3 units');

  // Add real catalog product with limited stock assumption
  const guestCart = await cartService.getOrCreateCart();
  const cartId = guestCart.id;
  assert(Boolean(cartId), 'Guest cart created');

  // Attempt to add 5 units when only 3 are available
  // To test cartService with catalog product, pick a catalog product and set its stock to 3
  const targetProd = products.find((p) => p.isActive && p.stockStatus !== 'out_of_stock') || products[0];
  const targetDocId = targetProd.documentId;
  const targetInv = inventoryService.getRepository().findByProductReference(targetDocId);
  const originalAvailable = targetInv ? targetInv.available_quantity : 24;

  // Temporarily set to 3 units
  db.prepare('UPDATE inventory_items SET available_quantity = 3, reserved_quantity = 0 WHERE product_reference = ?').run(targetDocId);

  let cartAddRejected = false;
  try {
    await cartService.addItem(cartId, { productDocumentId: targetDocId, quantity: 5 });
  } catch (err: any) {
    cartAddRejected = true;
    assert(err.message.includes('Only 3 pieces available'), `Cart rejected impossible quantity: "${err.message}"`);
  }
  assert(cartAddRejected, 'Cart quantity > sellable stock rejected');

  // Add permitted quantity of 2
  await cartService.addItem(cartId, { productDocumentId: targetDocId, quantity: 2 });
  const updatedCart = await cartService.getCart(cartId);
  const cartItem = updatedCart.items[0];
  assert(cartItem.quantity === 2, 'Added permitted quantity (2 units) to hamper');

  // Try updating quantity to 10 (exceeds 3)
  let cartUpdateRejected = false;
  try {
    await cartService.updateItemQuantity(cartId, cartItem.id, 10);
  } catch (err: any) {
    cartUpdateRejected = true;
    assert(err.message.includes('Only 3 pieces available'), `Cart update rejected impossible quantity: "${err.message}"`);
  }
  assert(cartUpdateRejected, 'Cart update > sellable stock rejected');

  // --- 4. Stock Reservation & Online Payment Lifecycle ---
  console.log('\n--- 4. Testing Checkout Stock Reservation & Online Payment Lifecycle ---');
  // Set target stock to 10 units
  db.prepare('UPDATE inventory_items SET available_quantity = 10, reserved_quantity = 0, sold_quantity = 0 WHERE product_reference = ?').run(targetDocId);

  // Clear cart and add 2 units
  await cartService.clearCart(cartId);
  await cartService.addItem(cartId, { productDocumentId: targetDocId, quantity: 2 });

  // Place online order
  const onlineOrderInput = {
    cartId,
    customer: {
      name: 'Priya Nair',
      email: 'priya.nair@example.com',
      phone: '9876543210',
    },
    deliveryAddress: {
      line1: '42 Coconut Grove Avenue',
      city: 'Kochi',
      state: 'Kerala',
      postalCode: '682001',
      country: 'India',
    },
    paymentMethod: 'online' as const,
  };

  const createdOrder = await orderService.createOrder(onlineOrderInput);
  assert(createdOrder.status === 'pending', 'Online order placed with pending status');

  // Verify stock is RESERVED, not deducted
  let invAfterOrder = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterOrder.available_quantity === 10, 'Available stock unchanged at 10');
  assert(invAfterOrder.reserved_quantity === 2, 'Reserved quantity incremented to 2');
  assert(invAfterOrder.sellable_quantity === 8, 'Sellable stock reduced to 8 (10 - 2)');

  // Verify reservation record
  const reservations = inventoryService.getRepository().getReservations({ orderId: createdOrder.id });
  assert(reservations.length === 1, 'Reservation record created in stock_reservations');
  assert(reservations[0].status === 'reserved', 'Reservation status is reserved');
  assert(reservations[0].quantity === 2, 'Reservation quantity is 2');

  // Initiate payment attempt
  const payAttempt = await paymentService.initiatePayment({
    orderId: createdOrder.id,
    method: 'upi',
  });
  assert(payAttempt.status === 'created', 'Payment attempt initialized');

  // Simulate payment failure
  await paymentService.processPayment(payAttempt.id, {
    scenario: 'failure',
  });

  // Verify stock reservation was RELEASED
  let invAfterFail = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterFail.reserved_quantity === 0, 'Reservation released on payment failure');
  assert(invAfterFail.sellable_quantity === 10, 'Sellable stock restored to 10');

  // Test Payment Retry (Re-reserves stock!)
  console.log('\n--- 5. Testing Payment Retry Re-reservation ---');
  const retryPayAttempt = await paymentService.initiatePayment({
    orderId: createdOrder.id,
    method: 'card',
  });
  let invAfterRetry = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterRetry.reserved_quantity === 2, 'Stock re-reserved on payment retry');
  assert(invAfterRetry.sellable_quantity === 8, 'Sellable stock reduced back to 8');

  // Simulate Payment Success
  await paymentService.processPayment(retryPayAttempt.id, { scenario: 'success' });
  let invAfterSuccess = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterSuccess.available_quantity === 8, 'Available stock deducted to 8 (10 - 2)');
  assert(invAfterSuccess.reserved_quantity === 0, 'Reserved quantity cleared to 0');
  assert(invAfterSuccess.sold_quantity === 2, 'Sold quantity incremented to 2');

  const finalRes = inventoryService.getRepository().getReservations({ orderId: createdOrder.id });
  assert(finalRes.some((r) => r.status === 'completed'), 'Reservation marked completed upon payment success');

  // --- 6. COD Order Stock Flow ---
  console.log('\n--- 6. Testing COD Stock Flow (Immediate Confirmed Allocation) ---');
  const codCart = await cartService.getOrCreateCart();
  const codCartId = codCart.id;
  await cartService.addItem(codCartId, { productDocumentId: targetDocId, quantity: 3 });

  const codOrder = await orderService.createOrder({
    cartId: codCartId,
    customer: {
      name: 'Rohan Varma',
      email: 'rohan.varma@example.com',
      phone: '9845123456',
    },
    deliveryAddress: {
      line1: '15 Heritage Walkway',
      city: 'Kozhikode',
      state: 'Kerala',
      postalCode: '673001',
      country: 'India',
    },
    paymentMethod: 'cod',
  });
  assert(codOrder.status === 'confirmed', 'COD order confirmed immediately');

  let invAfterCod = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterCod.available_quantity === 5, 'Available stock immediately allocated for COD (8 - 3 = 5)');
  assert(invAfterCod.sold_quantity === 5, 'Sold quantity increased to 5 (2 + 3)');
  assert(invAfterCod.reserved_quantity === 0, 'Reserved quantity is 0');

  // --- 7. Order Cancellation Stock Return ---
  console.log('\n--- 7. Testing Order Cancellation Stock Return ---');
  // Cancel COD order via Admin
  await adminOrderService.updateOrderStatus(codOrder.id, 'cancelled', adminId, 'Customer requested order cancellation');

  let invAfterCancel = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterCancel.available_quantity === 8, 'Available stock restored from 5 to 8');
  assert(invAfterCancel.sold_quantity === 2, 'Sold quantity decremented back from 5 to 2');

  // Check movement log for ORDER_CANCELLED
  const { movements: cancelMovements } = inventoryService.getRepository().getMovements({
    productReference: targetDocId,
    limit: 5,
  });
  const hasCancelMovement = cancelMovements.some((m) => m.movement_type === 'ORDER_CANCELLED');
  assert(hasCancelMovement, 'ORDER_CANCELLED recorded in stock movements ledger');

  // --- 8. Concurrent Stock Purchase Protection ---
  console.log('\n--- 8. Testing Concurrent Purchase Simulation (Race Condition) ---');
  // Set product to exactly 1 sellable unit
  db.prepare('UPDATE inventory_items SET available_quantity = 1, reserved_quantity = 0 WHERE product_reference = ?').run(targetDocId);

  // Simulate two concurrent checkout attempts for 1 unit
  const orderIdA = crypto.randomUUID();
  const orderIdB = crypto.randomUUID();

  // Insert valid order records to satisfy foreign key constraint on stock_reservations
  const insertDummyOrder = (id: string, num: string) => {
    db.prepare(`
      INSERT INTO orders (
        id, order_number, access_token, customer_name, customer_email,
        customer_phone, delivery_address_line1, delivery_city, delivery_state,
        delivery_postal_code, subtotal_paise, shipping_paise, grand_total_paise
      ) VALUES (?, ?, 'tok_${id}', 'Concurrent Shopper', 'concurrent@example.com', '9876543210', 'Street 1', 'Kochi', 'Kerala', '682001', 100000, 0, 100000)
    `).run(id, num);
  };
  insertDummyOrder(orderIdA, `CC-CONCUR-A-${Date.now()}`);
  insertDummyOrder(orderIdB, `CC-CONCUR-B-${Date.now()}`);

  const items = [{ productReference: targetDocId, quantity: 1 }];

  let customerASucceeded = false;
  let customerBSucceeded = false;

  const results = await Promise.allSettled([
    Promise.resolve().then(() => {
      inventoryService.reserveOrderStock(orderIdA, items);
      customerASucceeded = true;
    }),
    Promise.resolve().then(() => {
      inventoryService.reserveOrderStock(orderIdB, items);
      customerBSucceeded = true;
    }),
  ]);

  const successes = [customerASucceeded, customerBSucceeded].filter(Boolean).length;
  assert(successes === 1, `Exactly one customer succeeded in race condition (successes: ${successes})`);
  const invAfterRace = inventoryService.getRepository().findByProductReference(targetDocId)!;
  assert(invAfterRace.reserved_quantity === 1, 'Reserved quantity is exactly 1');
  assert(invAfterRace.sellable_quantity === 0, 'Sellable stock is 0, preventing overselling');

  // Clean up race test reservation
  if (customerASucceeded) inventoryService.releaseOrderStock(orderIdA, 'Test clean up');
  if (customerBSucceeded) inventoryService.releaseOrderStock(orderIdB, 'Test clean up');

  // Restore target product to original available quantity
  db.prepare('UPDATE inventory_items SET available_quantity = ?, reserved_quantity = 0 WHERE product_reference = ?').run(originalAvailable, targetDocId);

  // --- 9. Admin Inventory API Verification ---
  console.log('\n--- 9. Testing Admin Inventory API Endpoints ---');
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    Accept: 'application/json',
  };

  // Test GET /api/admin/inventory
  const adminInvRes = await fetch(`${BASE_URL}/admin/inventory?limit=10`, { headers: adminHeaders });
  const adminInvJson = await adminInvRes.json();
  assert(adminInvRes.ok && adminInvJson.success === true, 'Admin inventory list endpoint returned success');
  assert(Array.isArray(adminInvJson.data.items), 'Returns array of inventory items');
  assert(Boolean(adminInvJson.data.metrics), 'Returns dashboard inventory metrics');

  // Test GET /api/admin/inventory/:productReference
  const adminDetailRes = await fetch(`${BASE_URL}/admin/inventory/${targetDocId}`, { headers: adminHeaders });
  const adminDetailJson = await adminDetailRes.json();
  assert(adminDetailRes.ok && adminDetailJson.success === true, 'Admin inventory detail endpoint returned success');
  assert(Array.isArray(adminDetailJson.data.movements), 'Returns movement timeline in detail');

  // Test GET /api/admin/inventory/movements
  const adminMovRes = await fetch(`${BASE_URL}/admin/inventory/movements?limit=10`, { headers: adminHeaders });
  const adminMovJson = await adminMovRes.json();
  assert(adminMovRes.ok && adminMovJson.success === true, 'Admin stock movements ledger returned success');
  assert(adminMovJson.data.movements.length > 0, 'Movement ledger contains recorded events');

  // Test POST /api/admin/inventory/:productReference/adjust
  const adjustRes = await fetch(`${BASE_URL}/admin/inventory/${targetDocId}/adjust`, {
    method: 'POST',
    headers: {
      ...adminHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'add',
      quantity: 5,
      reason: 'Admin API integration test',
    }),
  });
  const adjustJson = await adjustRes.json();
  assert(adjustRes.ok && adjustJson.success === true, 'Admin stock adjustment API succeeds with authenticated session');

  console.log('\n============================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
