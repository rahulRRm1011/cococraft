import { adminAuthService } from '../src/services/adminAuth.service.js';
import { adminUserRepository } from '../src/repositories/adminUser.repository.js';
import { orderRepository } from '../src/repositories/order.repository.js';
import { paymentRepository } from '../src/repositories/payment.repository.js';
import { orderEventRepository } from '../src/repositories/orderEvent.repository.js';
import { getDatabase } from '../src/database/index.js';

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
  console.log('🧪 ========================================');
  console.log('🧪 COCOCRAFT CHECKPOINT 6 BACKEND TEST SUITE');
  console.log('🧪 ADMIN AUTH, DASHBOARD, ORDERS & PAYMENTS');
  console.log('🧪 ========================================\n');

  // --- 1. Password Hashing & Admin Bootstrap ---
  console.log('--- 1. Testing Admin Password Hashing & Storage ---');
  const testEmail = `admin_test_${Date.now()}@cococraft.com`;
  const rawPassword = 'SecretAtelier@2026';
  
  const createdAdmin = await adminAuthService.createAdmin(
    testEmail,
    rawPassword,
    'Test Operations Lead',
    'admin'
  );

  const dbAdminRecord = adminUserRepository.findByEmail(testEmail)!;
  assert(Boolean(dbAdminRecord), 'Admin record exists in admin_users table');
  assert(dbAdminRecord.password_hash !== rawPassword, 'Password is NOT stored in plaintext');
  assert(dbAdminRecord.password_hash.startsWith('$2'), 'Password uses bcrypt hash format');
  
  const pwMatch = await adminAuthService.verifyPassword(rawPassword, dbAdminRecord.password_hash);
  assert(pwMatch === true, 'Bcrypt verification succeeds for valid password');
  
  const pwMismatch = await adminAuthService.verifyPassword('WrongPassword123', dbAdminRecord.password_hash);
  assert(pwMismatch === false, 'Bcrypt verification fails for wrong password');

  // Verify inactive admin cannot login
  db.prepare(`UPDATE admin_users SET is_active = 0 WHERE id = ?`).run(createdAdmin.id);
  let inactiveFailed = false;
  try {
    await adminAuthService.login(testEmail, rawPassword);
  } catch (err: any) {
    inactiveFailed = true;
    assert(err.message.includes('credentials'), 'Inactive admin login is rejected with generic error');
  }
  assert(inactiveFailed, 'Inactive admin account blocked from signing in');

  // Re-enable for subsequent testing
  db.prepare(`UPDATE admin_users SET is_active = 1 WHERE id = ?`).run(createdAdmin.id);

  // --- 2. Admin Authentication API ---
  console.log('\n--- 2. Testing Admin Auth API (Login, Cookie, Me, Logout) ---');
  // Wrong credentials
  const badLoginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'IncorrectPassword' }),
  });
  assert(badLoginRes.status === 401, 'Bad credentials return HTTP 401');
  const badLoginJson = await badLoginRes.json();
  assert(badLoginJson.error.includes('credentials'), 'Bad credentials return generic error without account enumeration');

  // Valid login
  const loginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: rawPassword }),
  });
  assert(loginRes.status === 200, 'Valid login returns HTTP 200');
  
  const loginCookie = loginRes.headers.get('set-cookie') || '';
  assert(loginCookie.includes('cococraft_admin_session'), 'HttpOnly cococraft_admin_session cookie issued');
  assert(loginCookie.includes('HttpOnly'), 'Admin cookie has HttpOnly flag');
  
  const loginJson = await loginRes.json();
  assert(!loginJson.data.user.password_hash, 'Password hash is NOT exposed in login response');
  assert(loginJson.data.user.email === testEmail, 'Authenticated user profile returned');
  const token = loginJson.data.token;

  // GET /api/admin/auth/me with Cookie
  const cookieHeader = loginCookie.split(';')[0];
  const meRes = await fetch(`${BASE_URL}/admin/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  assert(meRes.status === 200, 'GET /admin/auth/me succeeds with admin cookie');
  const meJson = await meRes.json();
  assert(meJson.data.id === createdAdmin.id, 'GET /admin/auth/me returns current authenticated admin profile');

  // GET /api/admin/auth/me with Bearer token
  const meBearerRes = await fetch(`${BASE_URL}/admin/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(meBearerRes.status === 200, 'GET /admin/auth/me succeeds with Authorization Bearer header');

  // --- 3. Unauthorized API Access Protection ---
  console.log('\n--- 3. Testing Unauthorized Access Protection (401) ---');
  const unauthDashboard = await fetch(`${BASE_URL}/admin/dashboard`);
  assert(unauthDashboard.status === 401, 'GET /admin/dashboard returns 401 without auth');

  const unauthOrders = await fetch(`${BASE_URL}/admin/orders`);
  assert(unauthOrders.status === 401, 'GET /admin/orders returns 401 without auth');

  const unauthPayments = await fetch(`${BASE_URL}/admin/payments`);
  assert(unauthPayments.status === 401, 'GET /admin/payments returns 401 without auth');

  const unauthStatus = await fetch(`${BASE_URL}/admin/orders/some-id/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'processing' }),
  });
  assert(unauthStatus.status === 401, 'PATCH /admin/orders/:id/status returns 401 without auth');

  // --- 4. Dashboard Metrics Verification ---
  console.log('\n--- 4. Testing Dashboard Real Database Aggregation ---');
  const dashRes = await fetch(`${BASE_URL}/admin/dashboard?range=30d`, {
    headers: { Cookie: cookieHeader },
  });
  assert(dashRes.status === 200, 'GET /admin/dashboard succeeds for authenticated admin');
  const dashJson = await dashRes.json();
  const summary = dashJson.data.summary;
  
  // Cross check with direct DB query
  const directCount = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE datetime(created_at) >= datetime('now', '-30 days')`).get() as any;
  assert(summary.totalOrders === directCount.c, 'Dashboard totalOrders matches direct SQLite count');
  assert(typeof summary.totalOrderValuePaise === 'number', 'Summary contains totalOrderValuePaise');
  assert(typeof summary.paidOnlineValuePaise === 'number', 'Summary contains paidOnlineValuePaise');
  assert(typeof summary.codOrderValuePaise === 'number', 'Summary contains codOrderValuePaise');
  assert(Array.isArray(dashJson.data.orderTrend), 'Dashboard contains orderTrend points');
  assert(Array.isArray(dashJson.data.paymentMethodDistribution), 'Dashboard contains paymentMethodDistribution');
  assert(Array.isArray(dashJson.data.orderStatusDistribution), 'Dashboard contains orderStatusDistribution');
  assert(Array.isArray(dashJson.data.recentOrders), 'Dashboard contains recentOrders list');
  assert(Array.isArray(dashJson.data.recentPayments), 'Dashboard contains recentPayments list');

  // --- 5. Orders Pagination, Search, Filters & Sorting ---
  console.log('\n--- 5. Testing Orders Ledger (Pagination, Search, Filters, Sorting) ---');
  const pagedRes = await fetch(`${BASE_URL}/admin/orders?page=1&limit=5&sortBy=created_at&sortDir=desc`, {
    headers: { Cookie: cookieHeader },
  });
  assert(pagedRes.status === 200, 'GET /admin/orders pagination query succeeds');
  const pagedJson = await pagedRes.json();
  assert(pagedJson.data.limit === 5, 'Page limit respected (5 items)');
  assert(pagedJson.data.items.length <= 5, 'Items array length within requested limit');
  assert(typeof pagedJson.data.total === 'number', 'Total record count returned');
  assert(typeof pagedJson.data.totalPages === 'number', 'Total pages calculated');

  // Test search by customer or order number
  if (pagedJson.data.items.length > 0) {
    const targetOrder = pagedJson.data.items[0];
    const searchRes = await fetch(`${BASE_URL}/admin/orders?search=${encodeURIComponent(targetOrder.orderNumber)}`, {
      headers: { Cookie: cookieHeader },
    });
    const searchJson = await searchRes.json();
    assert(searchJson.data.items.some((o: any) => o.orderNumber === targetOrder.orderNumber), 'Search by exact order number finds target record');
  }

  // --- 6. Order Status State Machine & Audit Events ---
  console.log('\n--- 6. Testing Order Status State Machine & Audit Events ---');
  // Create a fresh test order in confirmed status
  const testOrderId = `ord_test_${Date.now()}`;
  const testOrderNumber = orderRepository.generateOrderNumber();
  db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_city, delivery_state, delivery_postal_code,
      subtotal_paise, shipping_paise, grand_total_paise, payment_method, payment_status,
      order_status, created_at, updated_at
    ) VALUES (
      ?, ?, 'token_test', 'Rukmini Devi', 'rukmini@example.com', '9847000000',
      'Artisan Way 10', 'Thrissur', 'Kerala', '680001',
      120000, 0, 120000, 'cod', 'unpaid', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(testOrderId, testOrderNumber);

  // Test Invalid Transition: confirmed -> delivered (must fail, only confirmed -> processing or cancelled)
  const invalidTransitionRes = await fetch(`${BASE_URL}/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ status: 'delivered' }),
  });
  assert(invalidTransitionRes.status === 400, 'Invalid transition (confirmed -> delivered) is rejected with HTTP 400');
  const invalidJson = await invalidTransitionRes.json();
  assert(invalidJson.error.includes('Invalid status transition'), 'Rejection error specifies state machine violation');

  // Test Valid Transition: confirmed -> processing
  const validProcessingRes = await fetch(`${BASE_URL}/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ status: 'processing', note: 'Items allocated to workshop seasoning' }),
  });
  assert(validProcessingRes.status === 200, 'Valid transition (confirmed -> processing) succeeds');
  const procOrder = orderRepository.findOrderById(testOrderId)!;
  assert(procOrder.order_status === 'processing', 'Order status updated to processing in SQLite');

  // Verify Audit Event logged in order_events table
  const auditEvents = orderEventRepository.findEventsByOrderId(testOrderId);
  assert(auditEvents.length === 1, 'Exactly 1 audit event created in order_events');
  assert(auditEvents[0].fromStatus === 'confirmed', 'Audit event records previous status (confirmed)');
  assert(auditEvents[0].toStatus === 'processing', 'Audit event records target status (processing)');
  assert(auditEvents[0].adminUserId === createdAdmin.id, 'Audit event attributes action to authenticated admin ID');
  assert(auditEvents[0].adminName === createdAdmin.displayName, 'Audit event includes admin display name');

  // Test Valid Transition: processing -> shipped
  const validShippedRes = await fetch(`${BASE_URL}/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ status: 'shipped', note: 'Dispatched via Kerala Postal Express' }),
  });
  assert(validShippedRes.status === 200, 'Valid transition (processing -> shipped) succeeds');

  // Test Valid Transition: shipped -> delivered
  const validDeliveredRes = await fetch(`${BASE_URL}/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ status: 'delivered', note: 'Customer accepted courier delivery' }),
  });
  assert(validDeliveredRes.status === 200, 'Valid transition (shipped -> delivered) succeeds');
  const delOrder = orderRepository.findOrderById(testOrderId)!;
  assert(delOrder.order_status === 'delivered', 'Order status reached terminal state "delivered"');

  // Terminal state protection: delivered -> processing must fail
  const terminalTransitionRes = await fetch(`${BASE_URL}/admin/orders/${testOrderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ status: 'processing' }),
  });
  assert(terminalTransitionRes.status === 400, 'Transition from terminal state "delivered" is rejected');

  // --- 7. Order Detail & Unified Timeline ---
  console.log('\n--- 7. Testing Order Detail & Unified Chronological Timeline ---');
  const detailRes = await fetch(`${BASE_URL}/admin/orders/${testOrderId}`, {
    headers: { Cookie: cookieHeader },
  });
  assert(detailRes.status === 200, 'GET /admin/orders/:orderId loads order details');
  const detailJson = await detailRes.json();
  const timeline = detailJson.data.timeline;
  assert(Array.isArray(timeline), 'Order detail contains timeline array');
  assert(timeline.length >= 4, 'Timeline contains order creation + 3 status change events');
  assert(timeline[0].title === 'Order Placed', 'First timeline item is Order Placed');

  // --- 8. Payments Monitoring API ---
  console.log('\n--- 8. Testing Payments Monitoring API ---');
  const paymentsRes = await fetch(`${BASE_URL}/admin/payments?page=1&limit=10`, {
    headers: { Cookie: cookieHeader },
  });
  assert(paymentsRes.status === 200, 'GET /admin/payments succeeds');
  const paymentsJson = await paymentsRes.json();
  assert(typeof paymentsJson.data.total === 'number', 'Payments monitor returns total attempt count');
  assert(Array.isArray(paymentsJson.data.items), 'Payments monitor returns items array');

  if (paymentsJson.data.items.length > 0) {
    const firstPayment = paymentsJson.data.items[0];
    const singlePayRes = await fetch(`${BASE_URL}/admin/payments/${firstPayment.id}`, {
      headers: { Cookie: cookieHeader },
    });
    assert(singlePayRes.status === 200, 'GET /admin/payments/:id returns payment attempt details');
  }

  // --- 9. Admin Logout & Session Invalidation ---
  console.log('\n--- 9. Testing Admin Logout & Session Invalidation ---');
  const logoutRes = await fetch(`${BASE_URL}/admin/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  });
  assert(logoutRes.status === 200, 'POST /admin/auth/logout returns HTTP 200');

  // Verify that the same cookie no longer works
  const meAfterLogout = await fetch(`${BASE_URL}/admin/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  assert(meAfterLogout.status === 401, 'Logged out session cookie is rejected with HTTP 401');

  // --- 10. Checkpoint 5 & 4 Regression Verification ---
  console.log('\n--- 10. Testing Checkpoint 5 & 4 Regression ---');
  // Check that public health and catalog endpoints are untouched
  const healthRes = await fetch(`${BASE_URL}/health`);
  assert(healthRes.status === 200, 'Storefront /api/health endpoint intact');

  const productsRes = await fetch(`${BASE_URL}/products`);
  assert(productsRes.status === 200, 'Storefront /api/products catalog intact');

  console.log('\n========================================');
  console.log(`CHECKPOINT 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
