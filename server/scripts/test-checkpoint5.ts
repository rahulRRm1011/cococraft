import { getDatabase } from '../src/database/index.js';
import { catalogService } from '../src/services/catalog.service.js';

const API_BASE = 'http://localhost:4000/api';

async function main() {
  console.log('🧪 ========================================');
  console.log('🧪 COCOCRAFT CHECKPOINT 5 BACKEND TEST SUITE');
  console.log('🧪 MOCK PAYMENT GATEWAY & LIFECYCLE');
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

  const db = getDatabase();
  const products = await catalogService.getProducts();
  const testProduct = products[0];

  // 1. Online Order Creation (Awaiting Payment)
  console.log('--- 1. Testing Online Order Creation (Awaiting Payment) ---');
  const cartRes = await fetch(`${API_BASE}/cart`, { method: 'POST' });
  const cartData = await cartRes.json();
  const cartId = cartData.data.id;

  await fetch(`${API_BASE}/cart/${cartId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productDocumentId: testProduct.documentId, quantity: 1 })
  });

  const onlineOrderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId,
      customer: { name: 'Kavita Sundaram', email: 'kavita@example.com', phone: '9847123456' },
      deliveryAddress: { line1: '45 Palm View', city: 'Kochi', state: 'Kerala', postalCode: '682001' },
      paymentMethod: 'online'
    })
  });
  const onlineOrderData = await onlineOrderRes.json();
  assert(onlineOrderRes.status === 201, 'Online order created with status 201');
  const order = onlineOrderData.data;
  assert(order.status === 'pending', 'Online order status is "pending" (awaiting payment)');
  assert(order.paymentStatus === 'unpaid', 'Online order paymentStatus is "unpaid"');

  // Verify cart is NOT cleared yet (preserved for retry / recovery)
  const cartCheckBeforePay = await fetch(`${API_BASE}/cart/${cartId}`);
  const cartCheckData = await cartCheckBeforePay.json();
  assert(cartCheckData.data.items.length === 1, 'Cart items preserved while payment is pending');

  // 2. Payment Initiation
  console.log('\n--- 2. Testing Payment Initiation ---');
  const initIdempotencyKey = `pay-init-${Date.now()}`;
  const initRes = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': initIdempotencyKey
    },
    body: JSON.stringify({
      orderId: order.id,
      method: 'upi'
    })
  });
  const initData = await initRes.json();
  assert(initRes.status === 201 && initData.success === true, 'Payment attempt initiated successfully (201)');
  const attempt1 = initData.data;

  assert(attempt1.orderId === order.id, 'Payment linked to correct order');
  assert(/^CCPAY-2026-\d{6}$/.test(attempt1.paymentReference), `Payment reference format valid (${attempt1.paymentReference})`);
  assert(attempt1.amountPaise === order.grandTotalPaise, `Payment amount is server-authoritative (${attempt1.amountPaise} paise)`);
  assert(attempt1.status === 'created', 'Payment attempt status is "created"');
  assert(attempt1.attemptNumber === 1, 'First payment attempt has attemptNumber = 1');

  // Test Payment Initiation Idempotency
  const dupInitRes = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': initIdempotencyKey
    },
    body: JSON.stringify({
      orderId: order.id,
      method: 'upi'
    })
  });
  const dupInitData = await dupInitRes.json();
  assert(dupInitData.data.id === attempt1.id, 'Idempotent payment initiation returns existing attempt');

  // 3. Payment Failure & Multi-Attempt History
  console.log('\n--- 3. Testing Payment Failure & Multi-Attempt History ---');
  // Attempt 1: Process failure
  const failRes = await fetch(`${API_BASE}/payments/${attempt1.id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'failure' })
  });
  const failData = await failRes.json();
  assert(failData.data.status === 'failed', 'Payment attempt 1 marked as "failed"');
  assert(failData.data.failureCode === 'DEMO_DECLINED', 'Failure code recorded');

  // Verify order is still NOT marked as paid
  const orderCheckFail = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) as any;
  assert(orderCheckFail.payment_status === 'unpaid', 'Order remains unpaid after failed attempt');
  assert(orderCheckFail.order_status === 'pending', 'Order remains pending after failed attempt');

  // Attempt 2: Customer cancels
  const init2Res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order.id, method: 'card' })
  });
  const attempt2 = (await init2Res.json()).data;
  assert(attempt2.attemptNumber === 2, 'Second payment attempt has attemptNumber = 2');

  const cancelRes = await fetch(`${API_BASE}/payments/${attempt2.id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'cancel' })
  });
  const cancelData = await cancelRes.json();
  assert(cancelData.data.status === 'cancelled', 'Payment attempt 2 marked as "cancelled"');

  // Attempt 3: Customer retries with UPI and succeeds
  const init3Res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order.id, method: 'upi' })
  });
  const attempt3 = (await init3Res.json()).data;
  assert(attempt3.attemptNumber === 3, 'Third payment attempt has attemptNumber = 3');

  // Check payment history endpoint
  const historyRes = await fetch(`${API_BASE}/orders/${order.id}/payments`);
  const historyData = await historyRes.json();
  assert(historyData.data.length === 3, 'Payment history endpoint tracks all 3 attempts');
  assert(historyData.data[0].status === 'failed', 'Attempt 1 is recorded as failed');
  assert(historyData.data[1].status === 'cancelled', 'Attempt 2 is recorded as cancelled');
  assert(historyData.data[2].status === 'created', 'Attempt 3 is recorded as created');

  // 4. Payment Success Flow & Transactional Synchronization
  console.log('\n--- 4. Testing Payment Success & Atomic DB Finalization ---');
  const successRes = await fetch(`${API_BASE}/payments/${attempt3.id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'success', method: 'upi' })
  });
  const successData = await successRes.json();
  console.log('successRes debug:', successRes.status, successData);
  assert(successData.data?.status === 'paid', 'Attempt 3 marked as "paid"');
  assert(successData.data.completedAt !== null, 'completedAt timestamp recorded on payment');

  // Verify atomic DB updates in SQLite
  const dbOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) as any;
  assert(dbOrder.payment_status === 'paid', 'Order payment_status atomically updated to "paid"');
  assert(dbOrder.payment_method === 'upi', 'Order payment_method updated to "upi"');
  assert(dbOrder.order_status === 'confirmed', 'Order order_status atomically updated to "confirmed"');

  // Verify cart is NOW cleared after successful payment
  const cartCheckAfterSuccess = await fetch(`${API_BASE}/cart/${cartId}`);
  const cartCheckSuccessData = await cartCheckAfterSuccess.json();
  assert(cartCheckSuccessData.data.items.length === 0, 'Originating cart atomically cleared after payment success');

  // 5. Double-Success & Multiple-Tab Protection
  console.log('\n--- 5. Testing Double-Success & Multi-Tab Protection ---');
  // Re-processing attempt 3 (idempotent duplicate request)
  const dupSuccessRes = await fetch(`${API_BASE}/payments/${attempt3.id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'success' })
  });
  const dupSuccessData = await dupSuccessRes.json();
  assert(dupSuccessData.data.status === 'paid', 'Duplicate success request returns existing paid payment safely');

  // Attempting to initiate a new payment for an already-paid order
  const lateInitRes = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order.id, method: 'card' })
  });
  assert(lateInitRes.status === 400, 'Rejects payment initiation for already-paid order (400)');

  // Simulating concurrent Tab B trying to process Attempt 1 on already-paid order
  const lateProcessRes = await fetch(`${API_BASE}/payments/${attempt1.id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'success' })
  });
  assert(lateProcessRes.status === 400, 'Rejects payment processing for already-paid order (multi-tab protection)');

  // Confirm DB only has 1 successful payment
  const paidCount = db.prepare("SELECT COUNT(*) as count FROM payments WHERE order_id = ? AND status = 'paid'").get(order.id) as { count: number };
  assert(paidCount.count === 1, 'Database contains exactly ONE successful payment record');

  // 6. Asynchronous Pending Payment Flow & Reconciliation
  console.log('\n--- 6. Testing Pending Payment Flow & Reconciliation ---');
  const cartPRes = await fetch(`${API_BASE}/cart`, { method: 'POST' });
  const cartPId = (await cartPRes.json()).data.id;
  await fetch(`${API_BASE}/cart/${cartPId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productDocumentId: testProduct.documentId, quantity: 1 })
  });

  const orderPRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: cartPId,
      customer: { name: 'Manoj Kumar', email: 'manoj@example.com', phone: '9447123456' },
      deliveryAddress: { line1: '12 Temple Road', city: 'Thrissur', state: 'Kerala', postalCode: '680001' },
      paymentMethod: 'online'
    })
  });
  const orderP = (await orderPRes.json()).data;

  const initPRes = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: orderP.id, method: 'upi' })
  });
  const attemptP = (await initPRes.json()).data;

  // Process with demo.pending@cococraft or scenario pending
  const processPRes = await fetch(`${API_BASE}/payments/${attemptP.id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'pending' })
  });
  const processPData = await processPRes.json();
  assert(processPData.data.status === 'pending', 'Payment status set to "pending"');

  // Verify/reconcile pending payment
  const verifyRes = await fetch(`${API_BASE}/payments/${attemptP.id}/verify`, { method: 'POST' });
  const verifyData = await verifyRes.json();
  assert(verifyData.data.status === 'paid', 'Pending payment reconciled and verified to "paid"');

  // 7. Token-Less URL Confirmation Access via Session Cookie
  console.log('\n--- 7. Testing Token-Less URL Confirmation via Session Cookie ---');
  // Access with active cookie header (simulating browser)
  const cookieRes = await fetch(`${API_BASE}/orders/${order.id}/confirmation`, {
    headers: { 'Cookie': `cococraft_order_session=${order.accessToken}` }
  });
  const cookieData = await cookieRes.json();
  assert(cookieRes.status === 200 && cookieData.success === true, 'Confirmation loads WITHOUT token query param when session cookie is provided');

  // Access with NO cookie and NO token
  const noAuthRes = await fetch(`${API_BASE}/orders/${order.id}/confirmation`);
  assert(noAuthRes.status === 401, 'Confirmation access denied (401) when neither session cookie nor token is provided');

  // Backward compatibility: access with ?token=... query param
  const tokenRes = await fetch(`${API_BASE}/orders/${order.id}/confirmation?token=${order.accessToken}`);
  assert(tokenRes.status === 200, 'Confirmation still accessible via query token for backward compatibility');

  // 8. COD Regression Test
  console.log('\n--- 8. Testing Cash on Delivery (COD) Regression ---');
  const cartCodRes = await fetch(`${API_BASE}/cart`, { method: 'POST' });
  const cartCodId = (await cartCodRes.json()).data.id;
  await fetch(`${API_BASE}/cart/${cartCodId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productDocumentId: testProduct.documentId, quantity: 1 })
  });

  const codRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId: cartCodId,
      customer: { name: 'Arjun Das', email: 'arjun@example.com', phone: '9847111222' },
      deliveryAddress: { line1: '90 Fort Kochi', city: 'Kochi', state: 'Kerala', postalCode: '682001' },
      paymentMethod: 'cod'
    })
  });
  const codData = await codRes.json();
  assert(codRes.status === 201, 'COD order created with status 201');
  assert(codData.data.status === 'confirmed', 'COD order is confirmed immediately');
  assert(codData.data.paymentStatus === 'unpaid', 'COD order payment status is "unpaid"');
  assert(codData.data.paymentMethod === 'cod', 'COD order payment method is "cod"');

  console.log('\n========================================');
  console.log(`CHECKPOINT 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
