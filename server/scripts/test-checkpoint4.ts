import { getDatabase } from '../src/database/index.js';
import { catalogService } from '../src/services/catalog.service.js';

const API_BASE = 'http://localhost:4000/api';

async function main() {
  console.log('🧪 ========================================');
  console.log('🧪 COCOCRAFT CHECKPOINT 4 BACKEND TEST SUITE');
  console.log('🧪 ========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Test Shipping Config Endpoint
  console.log('--- 1. Testing Shipping Config Endpoint ---');
  const shipRes = await fetch(`${API_BASE}/orders/config/shipping`);
  const shipData = await shipRes.json();
  assert(shipRes.status === 200 && shipData.success === true, 'GET /api/orders/config/shipping returns 200');
  assert(shipData.data.freeShippingThreshold === 1500, 'Free shipping threshold is ₹1,500');
  assert(shipData.data.standardShippingFee === 99, 'Standard shipping fee is ₹99');
  assert(shipData.data.freeShippingThresholdPaise === 150000, 'Free shipping threshold in paise is 150,000');
  assert(shipData.data.standardShippingPaise === 9900, 'Standard shipping in paise is 9,900');

  // Fetch an active product from catalog to use in testing
  const products = await catalogService.getProducts();
  assert(products.length >= 20, `Catalog contains active products (found ${products.length})`);
  const testProduct1 = products[0]; // e.g. Malabar bowl
  const testProduct2 = products[1];

  // 2. Test Input Validation
  console.log('\n--- 2. Testing Server-side Validation ---');
  
  // Test invalid email
  const badEmailRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: 'dummy-cart-id',
      customer: { name: 'Rahul Sharma', email: 'not-an-email', phone: '9876543210' },
      deliveryAddress: { line1: '42 Marine Drive', city: 'Kochi', state: 'Kerala', postalCode: '682001' }
    })
  });
  const badEmailData = await badEmailRes.json();
  assert(badEmailRes.status === 400 && badEmailData.error?.includes('email'), 'Rejects invalid email format');

  // Test invalid Indian phone
  const badPhoneRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: 'dummy-cart-id',
      customer: { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '12345' },
      deliveryAddress: { line1: '42 Marine Drive', city: 'Kochi', state: 'Kerala', postalCode: '682001' }
    })
  });
  const badPhoneData = await badPhoneRes.json();
  assert(badPhoneRes.status === 400 && badPhoneData.error?.includes('mobile'), 'Rejects non-Indian or malformed phone number');

  // Test invalid Indian state
  const badStateRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: 'dummy-cart-id',
      customer: { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876543210' },
      deliveryAddress: { line1: '42 Marine Drive', city: 'Kochi', state: 'Narnia', postalCode: '682001' }
    })
  });
  const badStateData = await badStateRes.json();
  assert(badStateRes.status === 400 && badStateData.error?.includes('State'), 'Rejects invalid Indian State');

  // Test invalid 6-digit PIN
  const badPinRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: 'dummy-cart-id',
      customer: { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876543210' },
      deliveryAddress: { line1: '42 Marine Drive', city: 'Kochi', state: 'Kerala', postalCode: '012345' }
    })
  });
  const badPinData = await badPinRes.json();
  assert(badPinRes.status === 400 && badPinData.error?.includes('PIN'), 'Rejects invalid 6-digit PIN starting with 0');

  // 3. Test Order Creation with Cart Below Shipping Threshold
  console.log('\n--- 3. Testing Order Placement (< ₹1500 threshold with ₹99 shipping) ---');
  // Create cart
  const cartRes = await fetch(`${API_BASE}/cart`, { method: 'POST' });
  const cartData = await cartRes.json();
  const cartId = cartData.data.id;

  // Add 1 item of testProduct1
  await fetch(`${API_BASE}/cart/${cartId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productDocumentId: testProduct1.documentId, quantity: 1 })
  });

  const idempotencyKey1 = `test-key-${Date.now()}`;
  const orderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey1
    },
    body: JSON.stringify({
      cartId,
      customer: {
        name: 'Ananya Nair',
        email: 'ananya.nair@example.com',
        phone: '+91 98470 12345'
      },
      deliveryAddress: {
        line1: '14 Panampilly Nagar, Main Avenue',
        line2: 'Apartment 3B, Palm Grove',
        city: 'Kochi',
        state: 'Kerala',
        postalCode: '682036',
        country: 'India'
      },
      customerNote: 'Please deliver after 2 PM.'
    })
  });

  const orderData = await orderRes.json();
  console.log('order response debug:', orderRes.status, orderData);
  assert(orderRes.status === 201 && orderData.success === true, 'Order created successfully with status 201');
  const order = orderData.data;

  assert(/^CC-2026-\d{6}$/.test(order.orderNumber), `Order number format is CC-2026-XXXXXX (${order.orderNumber})`);
  assert(typeof order.accessToken === 'string' && order.accessToken.length >= 32, 'Order has secure crypto access token');
  assert(order.paymentStatus === 'unpaid', 'Payment status is "unpaid"');
  assert(order.paymentMethod === 'cod', 'Payment method is "cod" (Cash on Delivery)');
  assert(order.status === 'confirmed', 'Order status is "confirmed"');
  assert(order.customer.phone === '9847012345', 'Normalized Indian phone number saved');

  // Verify paise calculations
  const expectedSubtotalPaise = Math.round(testProduct1.price * 100);
  assert(order.subtotalPaise === expectedSubtotalPaise, `Subtotal in paise is ${expectedSubtotalPaise}`);
  assert(order.shippingPaise === 9900, 'Shipping fee is ₹99 (9900 paise) since subtotal < ₹1500');
  assert(order.grandTotalPaise === expectedSubtotalPaise + 9900, 'Grand total in paise is subtotal + shipping');
  assert(order.subtotal === testProduct1.price, `Subtotal in rupees is ₹${testProduct1.price}`);
  assert(order.shipping === 99, 'Shipping in rupees is ₹99');
  assert(order.grandTotal === testProduct1.price + 99, `Grand total in rupees is ₹${testProduct1.price + 99}`);

  // Verify Cart is cleared after successful order
  const checkCartRes = await fetch(`${API_BASE}/cart/${cartId}`);
  const checkCartData = await checkCartRes.json();
  assert(checkCartData.data.items.length === 0, 'Cart items are completely cleared after order placement');
  assert(checkCartData.data.subtotal === 0, 'Cart subtotal reset to 0');

  // 4. Test Idempotency
  console.log('\n--- 4. Testing Idempotency Protection ---');
  const duplicateOrderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey1
    },
    body: JSON.stringify({
      cartId,
      customer: {
        name: 'Ananya Nair',
        email: 'ananya.nair@example.com',
        phone: '9847012345'
      },
      deliveryAddress: {
        line1: '14 Panampilly Nagar',
        city: 'Kochi',
        state: 'Kerala',
        postalCode: '682036'
      }
    })
  });

  const duplicateOrderData = await duplicateOrderRes.json();
  assert(duplicateOrderRes.status === 201 || duplicateOrderRes.status === 200, 'Idempotent request returns success');
  assert(duplicateOrderData.data.id === order.id, 'Idempotent request returns identical order ID');
  assert(duplicateOrderData.data.orderNumber === order.orderNumber, 'Idempotent request returns identical order number');

  // Check DB directly: verify only 1 order with this idempotency key
  const db = getDatabase();
  const dbOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE idempotency_key = ?').get(idempotencyKey1) as { count: number };
  assert(dbOrders.count === 1, 'Database contains exactly 1 order row for this idempotency key');

  // 5. Test Free Shipping Threshold (>= ₹1500)
  console.log('\n--- 5. Testing Free Shipping Threshold (>= ₹1500) ---');
  const cart2Res = await fetch(`${API_BASE}/cart`, { method: 'POST' });
  const cart2Data = await cart2Res.json();
  const cartId2 = cart2Data.data.id;

  // Add 3 of testProduct1 or multiple items to exceed ₹1500
  await fetch(`${API_BASE}/cart/${cartId2}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productDocumentId: testProduct1.documentId, quantity: 4 })
  });

  const order2Res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: cartId2,
      customer: {
        name: 'Vikram Menon',
        email: 'vikram.menon@example.com',
        phone: '9447123456'
      },
      deliveryAddress: {
        line1: '88 MG Road, Ravipuram',
        city: 'Ernakulam',
        state: 'Kerala',
        postalCode: '682016'
      }
    })
  });
  const order2Data = await order2Res.json();
  assert(order2Res.status === 201, 'Order created successfully for cart >= ₹1500');
  assert(order2Data.data.subtotal >= 1500, `Subtotal ₹${order2Data.data.subtotal} qualifies for free shipping`);
  assert(order2Data.data.shipping === 0, 'Shipping fee is ₹0 (Free shipping)');
  assert(order2Data.data.grandTotal === order2Data.data.subtotal, 'Grand total equals subtotal with free shipping');

  // 6. Test Secure Confirmation Lookup
  console.log('\n--- 6. Testing Secure Confirmation Lookup ---');
  // Valid token
  const confirmRes = await fetch(`${API_BASE}/orders/${order.id}/confirmation?token=${order.accessToken}`);
  const confirmData = await confirmRes.json();
  assert(confirmRes.status === 200 && confirmData.success === true, 'Confirmation endpoint loads order with valid token');
  assert(confirmData.data.orderNumber === order.orderNumber, 'Loaded confirmation matches original order number');
  assert(confirmData.data.items.length === 1, 'Loaded confirmation contains immutable item snapshot');

  // Invalid token
  const badTokenRes = await fetch(`${API_BASE}/orders/${order.id}/confirmation?token=invalid_crypto_token`);
  assert(badTokenRes.status === 403, 'Rejects confirmation lookup with 403 Forbidden on invalid token');

  // Missing token
  const noTokenRes = await fetch(`${API_BASE}/orders/${order.id}/confirmation`);
  assert(noTokenRes.status === 401, 'Rejects confirmation lookup with 401 Unauthorized when token is missing');

  // Non-existent order ID
  const notFoundRes = await fetch(`${API_BASE}/orders/non-existent-order-id/confirmation?token=${order.accessToken}`);
  assert(notFoundRes.status === 404, 'Returns 404 Not Found for non-existent order ID');

  // 7. Test Item Snapshot Immutability
  console.log('\n--- 7. Testing Order Item Snapshot Immutability ---');
  const orderItemRow = db.prepare('SELECT * FROM order_items WHERE order_id = ?').get(order.id) as any;
  assert(orderItemRow.product_name === testProduct1.name, `Snapshot captures product_name: "${orderItemRow.product_name}"`);
  assert(orderItemRow.unit_price_paise === Math.round(testProduct1.price * 100), `Snapshot captures unit_price_paise: ${orderItemRow.unit_price_paise}`);
  assert(orderItemRow.sku !== undefined && orderItemRow.sku !== null, `Snapshot captures SKU: "${orderItemRow.sku}"`);

  // 8. Test Rollback on Failure & Cart Preservation
  console.log('\n--- 8. Testing Transaction Failure & Cart Preservation ---');
  const cart3Res = await fetch(`${API_BASE}/cart`, { method: 'POST' });
  const cart3Data = await cart3Res.json();
  const cartId3 = cart3Data.data.id;

  // Add 1 item
  await fetch(`${API_BASE}/cart/${cartId3}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productDocumentId: testProduct1.documentId, quantity: 1 })
  });

  // Attempt checkout with invalid state so order validation fails
  const failedOrderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: cartId3,
      customer: { name: 'Test User', email: 'test@example.com', phone: '9876543210' },
      deliveryAddress: { line1: 'Test Address', city: 'Test City', state: 'InvalidState', postalCode: '682001' }
    })
  });
  assert(failedOrderRes.status === 400, 'Order rejected due to validation failure');

  // Verify cart STILL contains the item!
  const cart3Check = await fetch(`${API_BASE}/cart/${cartId3}`);
  const cart3CheckData = await cart3Check.json();
  assert(cart3CheckData.data.items.length === 1, 'Cart items are PRESERVED when order creation fails');

  console.log('\n========================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
