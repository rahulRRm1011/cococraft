import crypto from 'crypto';
import { getDatabase } from '../src/database/index.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { orderRepository } from '../src/repositories/order.repository.js';
import { engagementRepository } from '../src/repositories/engagement.repository.js';
import { engagementService } from '../src/services/engagement.service.js';
import { customerAuthService } from '../src/services/customerAuth.service.js';
import { adminAnalyticsService } from '../src/services/adminAnalytics.service.js';
import { analyticsRepository } from '../src/repositories/analytics.repository.js';
import { catalogService } from '../src/services/catalog.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { paymentRepository } from '../src/repositories/payment.repository.js';

const db = getDatabase();

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
  console.log('🧪 ====================================================');
  console.log('🧪 COCOCRAFT CHECKPOINT 10 AUTOMATED TEST SUITE');
  console.log('🧪 ANALYTICS, SEARCH, FILTERING, SEO, & REGRESSION AUDIT');
  console.log('🧪 ====================================================\n');

  const ts = Date.now();

  // ---------------------------------------------------------
  // 1. BUSINESS ANALYTICS & DATABASE AGGREGATIONS
  // ---------------------------------------------------------
  console.log('--- 1. Testing Business Analytics Subsystem ---');

  // Seed sample orders across statuses
  const testOrderId1 = `ord_c10_paid_${ts}`;
  const testOrderNum1 = `CC-C10-${ts.toString().slice(-4)}1`;
  const testOrderId2 = `ord_c10_pend_${ts}`;
  const testOrderNum2 = `CC-C10-${ts.toString().slice(-4)}2`;

  const testCustomerEmail = `patron_c10_${ts}@example.com`;
  const regUser = await customerAuthService.register({
    name: 'Diya Krishnan',
    email: testCustomerEmail,
    password: 'ArtisanPassword#10',
    phone: '9847111222',
  });
  const customerId = regUser.customer.id;

  // Insert Paid Order (₹1,500 = 150000 paise)
  db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_city, delivery_state, delivery_postal_code, delivery_country,
      subtotal_paise, shipping_paise, discount_paise, tax_paise, grand_total_paise,
      currency, payment_method, payment_status, order_status, customer_id, created_at
    ) VALUES (
      ?, ?, ?, 'Diya Krishnan', ?, '9847111222',
      'Artisan Lane 1', 'Kochi', 'Kerala', '682001', 'India',
      150000, 0, 0, 0, 150000,
      'INR', 'online', 'paid', 'confirmed', ?, datetime('now')
    )
  `).run(testOrderId1, testOrderNum1, crypto.randomBytes(16).toString('hex'), testCustomerEmail, customerId);

  // Add line item
  db.prepare(`
    INSERT INTO order_items (
      order_id, product_document_id, product_slug, product_name, sku, quantity, unit_price_paise, line_total_paise, created_at
    ) VALUES (?, 'doc_candle_10', 'coconut-candle-holder', 'Artisan Coconut Candle Holder', 'SKU-CANDLE-10', 1, 150000, 150000, datetime('now'))
  `).run(testOrderId1);

  // Insert Pending Order (₹800 = 80000 paise)
  db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_city, delivery_state, delivery_postal_code, delivery_country,
      subtotal_paise, shipping_paise, discount_paise, tax_paise, grand_total_paise,
      currency, payment_method, payment_status, order_status, customer_id, created_at
    ) VALUES (
      ?, ?, ?, 'Diya Krishnan', ?, '9847111222',
      'Artisan Lane 1', 'Kochi', 'Kerala', '682001', 'India',
      80000, 0, 0, 0, 80000,
      'INR', 'online', 'pending', 'placed', ?, datetime('now')
    )
  `).run(testOrderId2, testOrderNum2, crypto.randomBytes(16).toString('hex'), testCustomerEmail, customerId);

  // Log behavioral events
  engagementRepository.recordEvent({
    customerId,
    eventType: 'PRODUCT_VIEWED',
    referenceId: 'coconut-candle-holder',
  });
  engagementRepository.recordEvent({
    customerId,
    eventType: 'CART_ADDED',
    referenceId: 'coconut-candle-holder',
  });
  engagementRepository.recordEvent({
    customerId,
    eventType: 'CHECKOUT_STARTED',
    referenceId: 'session_cart_10',
  });
  engagementRepository.recordEvent({
    customerId,
    eventType: 'ORDER_PLACED',
    referenceId: testOrderId1,
  });

  // Verify Sales Overview Calculation
  const salesOverview = analyticsRepository.getSalesOverview('today');
  assert(salesOverview.totalRevenueRupees >= 1500, `Sales overview calculates total order value: ₹${salesOverview.totalRevenueRupees}`);
  assert(salesOverview.completedOrdersCount >= 0, `Completed orders count >= 0: ${salesOverview.completedOrdersCount}`);
  assert(salesOverview.pendingOrdersCount >= 1, `Pending orders count >= 1: ${salesOverview.pendingOrdersCount}`);
  assert(salesOverview.averageOrderValueRupees > 0, `Average order value calculated: ₹${salesOverview.averageOrderValueRupees}`);

  // Verify Sales Trend Points
  const trend = analyticsRepository.getSalesTrend('30d');
  assert(Array.isArray(trend) && trend.length > 0, `Sales trend returns timeline data points: ${trend.length} points`);

  // Verify Customer Metrics
  const custMetrics = analyticsRepository.getCustomerMetrics('all');
  assert(custMetrics.totalCustomers >= 1, `Customer metrics calculates registered customers: ${custMetrics.totalCustomers}`);

  // Verify Funnel Progression
  const funnel = analyticsRepository.getShoppingFunnel('all');
  assert(funnel.length === 4, `Funnel has 4 distinct steps: ${funnel.map(f => f.step).join(' -> ')}`);
  assert(funnel[0].count > 0, `Funnel step 1 (views) recorded events: ${funnel[0].count}`);

  // Verify Comprehensive Admin Analytics Service
  const fullAnalytics = await adminAnalyticsService.getAnalytics('30d');
  assert(fullAnalytics.overview.totalRevenueRupees > 0, 'AdminAnalyticsService aggregated overview');
  assert(Array.isArray(fullAnalytics.categoryPerformance), 'AdminAnalyticsService aggregated category performance');
  assert(Array.isArray(fullAnalytics.productPerformance), 'AdminAnalyticsService aggregated product performance matrix');

  // ---------------------------------------------------------
  // 2. SEARCH & SEARCH SUGGESTIONS
  // ---------------------------------------------------------
  console.log('\n--- 2. Testing Search & Suggestions Engine ---');

  // Search by exact keyword
  const searchResults = await catalogService.getProducts({ search: 'candle' });
  assert(Array.isArray(searchResults), 'Search query executes successfully');
  if (searchResults.length > 0) {
    assert(
      searchResults.some(p => p.name.toLowerCase().includes('candle') || p.slug.includes('candle')),
      `Search query 'candle' matches product names or descriptions (${searchResults.length} found)`
    );
  }

  // Live suggestions endpoint
  const suggestions = await catalogService.getSearchSuggestions('bowl');
  assert(suggestions && Array.isArray(suggestions.products) && Array.isArray(suggestions.categories), 'Search suggestions returns products and categories');

  // ---------------------------------------------------------
  // 3. SERVER-SIDE MULTI-CRITERIA FILTERING
  // ---------------------------------------------------------
  console.log('\n--- 3. Testing Advanced Multi-Criteria Filtering ---');

  // Filter with price range
  const priceFiltered = await catalogService.getProducts({
    minPrice: 100,
    maxPrice: 3000,
  });
  assert(
    priceFiltered.every(p => p.price >= 100 && p.price <= 3000),
    `Price range filter ₹100-₹3000 respected: all ${priceFiltered.length} products within bounds`
  );

  // Sorting: Price Ascending
  const sortedAsc = await catalogService.getProducts({ sortBy: 'price-asc' });
  let isAscending = true;
  for (let i = 0; i < sortedAsc.length - 1; i++) {
    if (sortedAsc[i].price > sortedAsc[i + 1].price) {
      isAscending = false;
      break;
    }
  }
  assert(isAscending, 'Sorting by price-asc yields monotonic non-decreasing prices');

  // Sorting: Price Descending
  const sortedDesc = await catalogService.getProducts({ sortBy: 'price-desc' });
  let isDescending = true;
  for (let i = 0; i < sortedDesc.length - 1; i++) {
    if (sortedDesc[i].price < sortedDesc[i + 1].price) {
      isDescending = false;
      break;
    }
  }
  assert(isDescending, 'Sorting by price-desc yields monotonic non-increasing prices');

  // ---------------------------------------------------------
  // 4. SEO & DYNAMIC SITEMAP
  // ---------------------------------------------------------
  console.log('\n--- 4. Testing SEO & Sitemap Generation ---');

  const sitemapXml = await catalogService.generateSitemapXml();
  assert(sitemapXml.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'Sitemap includes valid XML declaration');
  assert(sitemapXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Sitemap has urlset schema namespace');
  assert(sitemapXml.includes('<loc>http://localhost:5173/</loc>'), 'Sitemap includes homepage');
  assert(sitemapXml.includes('<loc>http://localhost:5173/products</loc>'), 'Sitemap includes catalogue page');
  assert(sitemapXml.includes('</urlset>'), 'Sitemap closes urlset cleanly');

  // ---------------------------------------------------------
  // 5. REGRESSION SUITE: CHECKPOINTS 9 TO 4
  // ---------------------------------------------------------
  console.log('\n--- 5. Running Full Regression Test Suite ---');

  // Checkpoint 9: Wishlist
  await engagementService.addToWishlist(customerId, 'coconut-harvest-bowl');
  const isSaved = engagementService.isProductInWishlist(customerId, 'coconut-harvest-bowl');
  assert(isSaved, 'Checkpoint 9: Added item to wishlist');
  const wishlistItems = await engagementService.getCustomerWishlist(customerId);
  assert(wishlistItems.some(w => w.productReference === 'coconut-harvest-bowl'), 'Checkpoint 9: Retrieved wishlist containing saved creation');

  // Mark testOrderId1 as delivered for verified review eligibility
  db.prepare(`UPDATE orders SET order_status = 'delivered' WHERE id = ?`).run(testOrderId1);

  // Checkpoint 9: Reviews
  const review = await engagementService.createReview(customerId, {
    productReference: 'coconut-candle-holder',
    orderId: testOrderId1,
    rating: 5,
    title: 'Exquisite Kerala Craftsmanship',
    comment: 'The shell grain finish and warm glow exceed all expectations of artisan homeware.',
  });
  assert(Boolean(review && review.id), 'Checkpoint 9: Submitted verified product review');

  // Checkpoint 9: Coupons & Loyalty
  const coupon = engagementRepository.findCouponByCode('WELCOME10');
  assert(Boolean(coupon && coupon.discount_type === 'percentage'), 'Checkpoint 9: Standard welcome coupon retrieved');

  // Checkpoint 8: Customer Profile & Addresses
  const profile = customerRepository.findCustomerById(customerId);
  assert(Boolean(profile && profile.email === testCustomerEmail), 'Checkpoint 8: Customer profile retrieved');
  const addr = customerRepository.createAddress({
    id: crypto.randomUUID(),
    customerId,
    name: 'Diya Krishnan',
    phone: '9847111222',
    addressLine1: 'Artisan Villa 5',
    city: 'Kochi',
    state: 'Kerala',
    postalCode: '682001',
    country: 'India',
    isDefault: 1,
  });
  assert(Boolean(addr && addr.id), 'Checkpoint 8: Customer address saved successfully');

  // Checkpoint 7: Inventory & Stock Status
  const inventoryStock = inventoryService.getProductAvailability('coconut-harvest-bowl');
  assert(inventoryStock !== null, 'Checkpoint 7: Inventory availability query returns valid state');

  // Checkpoint 6: Admin Orders Query
  const adminOrder = orderRepository.findOrderById(testOrderId1);
  assert(Boolean(adminOrder && adminOrder.order_status === 'delivered'), 'Checkpoint 6: Admin order retrieved by ID with delivered status');

  // Checkpoint 5: Payments
  const paymentRecords = paymentRepository.findPaymentsByOrderId(testOrderId1);
  assert(Array.isArray(paymentRecords), 'Checkpoint 5: Payment records query executed successfully');

  // Checkpoint 4: Order Creation & Items
  const orderItems = orderRepository.findOrderItems(testOrderId1);
  assert(orderItems.length >= 1, `Checkpoint 4: Order items retrieved (${orderItems.length} items)`);

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log('\n====================================================');
  console.log(`🎯 CHECKPOINT 10 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
