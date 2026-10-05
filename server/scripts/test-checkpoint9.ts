import crypto from 'crypto';
import { getDatabase } from '../src/database/index.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { orderRepository } from '../src/repositories/order.repository.js';
import { engagementRepository } from '../src/repositories/engagement.repository.js';
import { engagementService } from '../src/services/engagement.service.js';
import { adminOrderService } from '../src/services/adminOrder.service.js';
import { customerAuthService } from '../src/services/customerAuth.service.js';

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
  console.log('🧪 COCOCRAFT CHECKPOINT 9 AUTOMATED TEST SUITE');
  console.log('🧪 CUSTOMER ENGAGEMENT, REVIEWS, WISHLIST, LOYALTY, COUPONS');
  console.log('🧪 ====================================================\n');

  const ts = Date.now();

  // Setup: Register Customer A and Customer B
  console.log('--- Setup: Test Customers ---');
  const userA = await customerAuthService.register({
    name: 'Ananya Nair',
    email: `ananya.nair_${ts}@example.com`,
    password: 'ArtisanPassword#1',
    phone: '9847012345',
  });
  const customerIdA = userA.customer.id;

  const userB = await customerAuthService.register({
    name: 'Vikram Menon',
    email: `vikram.menon_${ts}@example.com`,
    password: 'ArtisanPassword#2',
    phone: '9847054321',
  });
  const customerIdB = userB.customer.id;

  assert(Boolean(customerIdA && customerIdB), 'Created test customers A and B');

  // Setup: Create Orders for Customer A
  console.log('\n--- Setup: Seed Delivered Order for Customer A ---');
  const orderIdDelivered = `ord_test_deliv_${ts}`;
  const orderNumDelivered = `CC-${ts.toString().slice(-6)}`;
  const prodSlug = 'coconut-harvest-bowl';
  const prodDocId = 'doc_bowl_123';

  // Insert order for customer A in 'delivered' status
  db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_city, delivery_state, delivery_postal_code, delivery_country,
      subtotal_paise, shipping_paise, discount_paise, tax_paise, grand_total_paise,
      currency, payment_method, payment_status, order_status, customer_id
    ) VALUES (
      ?, ?, ?, 'Ananya Nair', ?, '9847012345',
      'Atelier Villa 4', 'Kochi', 'Kerala', '682001', 'India',
      120000, 0, 0, 0, 120000,
      'INR', 'online', 'paid', 'delivered', ?
    )
  `).run(orderIdDelivered, orderNumDelivered, crypto.randomBytes(16).toString('hex'), userA.customer.email, customerIdA);

  db.prepare(`
    INSERT INTO order_items (
      order_id, product_document_id, product_slug, product_name, sku,
      quantity, unit_price_paise, line_total_paise
    ) VALUES (
      ?, ?, ?, 'Coconut Harvest Bowl', 'BOWL-001',
      1, 120000, 120000
    )
  `).run(orderIdDelivered, prodDocId, prodSlug);

  // Insert another order for customer A in 'processing' status (not delivered yet)
  const orderIdProcessing = `ord_test_proc_${ts}`;
  db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_city, delivery_state, delivery_postal_code, delivery_country,
      subtotal_paise, shipping_paise, discount_paise, tax_paise, grand_total_paise,
      currency, payment_method, payment_status, order_status, customer_id
    ) VALUES (
      ?, ?, ?, 'Ananya Nair', ?, '9847012345',
      'Atelier Villa 4', 'Kochi', 'Kerala', '682001', 'India',
      80000, 0, 0, 0, 80000,
      'INR', 'online', 'paid', 'processing', ?
    )
  `).run(orderIdProcessing, `CC-${(ts + 1).toString().slice(-6)}`, crypto.randomBytes(16).toString('hex'), userA.customer.email, customerIdA);

  db.prepare(`
    INSERT INTO order_items (
      order_id, product_document_id, product_slug, product_name, sku,
      quantity, unit_price_paise, line_total_paise
    ) VALUES (
      ?, 'doc_spoon_456', 'palm-wood-spoon', 'Palm Wood Spoon', 'SPN-001',
      1, 80000, 80000
    )
  `).run(orderIdProcessing);

  assert(true, 'Seeded delivered and processing test orders');

  // ============================================================
  // 1. PRODUCT REVIEWS & SECURITY
  // ============================================================
  console.log('\n--- 1. Testing Product Review System & Security ---');

  // 1a. Verified buyer review submission succeeds
  let createdReviewId = '';
  try {
    const review = await engagementService.createReview(customerIdA, {
      productReference: prodSlug,
      orderId: orderIdDelivered,
      rating: 5,
      title: 'Exquisite Craftsmanship',
      comment: 'The bowl has an extraordinary natural coconut grain polish. Truly zero waste luxury.',
    });
    createdReviewId = review.id;
    assert(Boolean(review.id), 'Review successfully created with unique ID');
    assert(review.status === 'pending', 'New review is in pending status awaiting admin moderation');
    assert(review.rating === 5, 'Review rating recorded accurately');
  } catch (err: any) {
    assert(false, `Verified buyer review failed: ${err.message}`);
  }

  // 1b. Duplicate review for same order item rejected
  let duplicateCaught = false;
  try {
    await engagementService.createReview(customerIdA, {
      productReference: prodSlug,
      orderId: orderIdDelivered,
      rating: 4,
      title: 'Another review',
      comment: 'Attempting duplicate review for same delivered product',
    });
  } catch (err: any) {
    duplicateCaught = true;
    assert(err.message.includes('already submitted'), 'Duplicate review for same order item is rejected');
  }
  assert(duplicateCaught, 'Duplicate review prevention enforced');

  // 1c. Non-buyer review rejected (Customer B did not purchase or order this)
  let nonBuyerCaught = false;
  try {
    await engagementService.createReview(customerIdB, {
      productReference: prodSlug,
      orderId: orderIdDelivered,
      rating: 5,
      title: 'Fraudulent review',
      comment: 'I did not buy this order.',
    });
  } catch (err: any) {
    nonBuyerCaught = true;
    assert(err.message.includes('verified purchasers'), 'Non-buyer cannot review other customer order');
  }
  assert(nonBuyerCaught, 'Cross-customer order review spoofing rejected');

  // 1d. Non-delivered order cannot be reviewed
  let notDeliveredCaught = false;
  try {
    await engagementService.createReview(customerIdA, {
      productReference: 'palm-wood-spoon',
      orderId: orderIdProcessing,
      rating: 5,
      title: 'Too early',
      comment: 'Order is still processing',
    });
  } catch (err: any) {
    notDeliveredCaught = true;
    assert(err.message.includes('delivered'), 'Non-delivered order review is rejected');
  }
  assert(notDeliveredCaught, 'Order status must be delivered before review');

  // 1e. Review Rating boundary enforcement (1-5 only)
  let invalidRatingCaught = false;
  try {
    await engagementService.createReview(customerIdA, {
      productReference: prodSlug,
      orderId: orderIdDelivered,
      rating: 6,
      title: 'Bad rating',
      comment: 'Rating is out of bounds',
    });
  } catch (err: any) {
    invalidRatingCaught = true;
    assert(err.message.includes('between 1 and 5'), 'Rating outside 1-5 rejected');
  }
  assert(invalidRatingCaught, 'Rating boundary validation enforced');

  // 1f. Admin review moderation workflow
  console.log('\n--- 1f. Admin Review Moderation ---');
  const adminReviewsBefore = await engagementService.getAdminReviews({ status: 'pending' });
  const foundPending = adminReviewsBefore.items.find((r) => r.id === createdReviewId);
  assert(Boolean(foundPending), 'Admin review ledger includes pending review');

  // Approve review
  const approvedReview = await engagementService.updateReviewStatus(createdReviewId, 'approved');
  assert(approvedReview.status === 'approved', 'Admin successfully approved review');

  // Verify public product reviews list now includes approved review
  const publicSummary = await engagementService.getProductReviews(prodSlug);
  assert(publicSummary.totalReviews >= 1, 'Public review summary includes approved review count');
  assert(publicSummary.averageRating === 5, 'Public average rating calculated correctly');
  assert(publicSummary.distribution[5] >= 1, 'Rating distribution shows 5-star count');
  assert(publicSummary.reviews.some((r) => r.id === createdReviewId), 'Approved review returned in public reviews payload');

  // Admin hide review
  await engagementService.updateReviewStatus(createdReviewId, 'hidden');
  const publicSummaryAfterHide = await engagementService.getProductReviews(prodSlug);
  assert(!publicSummaryAfterHide.reviews.some((r) => r.id === createdReviewId), 'Hidden review removed from public storefront');

  // Restore to approved
  await engagementService.updateReviewStatus(createdReviewId, 'approved');

  // ============================================================
  // 2. WISHLIST SYSTEM
  // ============================================================
  console.log('\n--- 2. Testing Wishlist System ---');

  // 2a. Add to wishlist
  await engagementService.addToWishlist(customerIdA, 'coconut-brass-cup');
  const userAWishlist1 = await engagementService.getCustomerWishlist(customerIdA);
  assert(userAWishlist1.length === 1, 'Product added to customer wishlist');
  assert(userAWishlist1[0].productReference === 'coconut-brass-cup', 'Wishlist item reference recorded');

  // 2b. Duplicate prevention
  await engagementService.addToWishlist(customerIdA, 'coconut-brass-cup');
  const userAWishlistDup = await engagementService.getCustomerWishlist(customerIdA);
  assert(userAWishlistDup.length === 1, 'Duplicate wishlist addition safely ignored without duplicate');

  // Add a second product
  await engagementService.addToWishlist(customerIdA, 'cinnamon-clove-candle');
  const userAWishlist2 = await engagementService.getCustomerWishlist(customerIdA);
  assert(userAWishlist2.length === 2, 'Customer wishlist holds exactly 2 items');

  // 2d. Ownership isolation: Customer B sees empty wishlist
  const userBWishlist = await engagementService.getCustomerWishlist(customerIdB);
  assert(userBWishlist.length === 0, 'Customer B cannot view Customer A wishlist');

  // 2e. Remove from wishlist
  await engagementService.removeFromWishlist(customerIdA, 'coconut-brass-cup');
  const afterRemove = await engagementService.getCustomerWishlist(customerIdA);
  assert(afterRemove.length === 1, 'Product successfully removed from wishlist');
  assert(afterRemove[0].productReference === 'cinnamon-clove-candle', 'Correct item remains in wishlist');

  // ============================================================
  // 3. LOYALTY REWARDS SYSTEM
  // ============================================================
  console.log('\n--- 3. Testing Loyalty Rewards System ---');

  // 3a. Initial state: 0 points
  const initialLoyalty = await engagementService.getCustomerLoyalty(customerIdA);
  assert(initialLoyalty.pointsBalance === 0, 'New customer starts with 0 loyalty points');

  // 3b. Award points on order delivered lifecycle
  // Order was ₹1,200 (120,000 paise). Rule: 1 point per 1000 paise (₹10 spent) = 120 points.
  engagementService.awardLoyaltyPointsForOrder(orderIdDelivered);

  const updatedLoyalty = await engagementService.getCustomerLoyalty(customerIdA);
  assert(updatedLoyalty.pointsBalance === 120, 'Loyalty balance updated to 120 points');
  assert(updatedLoyalty.totalEarned === 120, 'Total lifetime earned updated');
  assert(updatedLoyalty.transactions.length === 1, 'Transaction recorded in loyalty ledger');
  assert(updatedLoyalty.transactions[0].type === 'earned', 'Transaction type is earned');

  // 3c. Duplicate award prevented (idempotent lifecycle)
  engagementService.awardLoyaltyPointsForOrder(orderIdDelivered);

  const loyaltyAfterDup = await engagementService.getCustomerLoyalty(customerIdA);
  assert(loyaltyAfterDup.pointsBalance === 120, 'Points balance remains 120 after duplicate attempt');
  assert(loyaltyAfterDup.transactions.length === 1, 'No duplicate transaction ledger entry created');

  // 3d. Non-delivered order cannot award points
  engagementService.awardLoyaltyPointsForOrder(orderIdProcessing);
  const loyaltyAfterProc = await engagementService.getCustomerLoyalty(customerIdA);
  assert(loyaltyAfterProc.pointsBalance === 120, 'Non-delivered order did not award loyalty points');

  // ============================================================
  // 4. COUPON VALIDATION & CONSTRAINTS
  // ============================================================
  console.log('\n--- 4. Testing Coupon Validation System ---');

  // Seed test coupons
  const couponWelcome = `WELCOME_${ts}`;
  await engagementService.createCoupon({
    code: couponWelcome,
    discountType: 'percentage',
    discountValue: 10, // 10%
    minimumOrderAmount: 1000, // ₹1,000
    maximumDiscount: 200, // max ₹200 cap
    usageLimit: 5,
  });

  const couponFixed = `FLAT100_${ts}`;
  await engagementService.createCoupon({
    code: couponFixed,
    discountType: 'fixed',
    discountValue: 100, // ₹100 flat
    minimumOrderAmount: 500,
    usageLimit: 1, // single use
  });

  const couponExpired = `EXPIRED_${ts}`;
  await engagementService.createCoupon({
    code: couponExpired,
    discountType: 'percentage',
    discountValue: 15,
    minimumOrderAmount: 0,
    expiryDate: new Date(Date.now() - 86400000).toISOString(), // yesterday
  });

  // 4a. Valid percentage coupon with spend above threshold
  // Cart subtotal ₹1,500 (150,000 paise) -> 10% = ₹150 (15,000 paise), which is under ₹200 cap
  const res1 = await engagementService.validateCoupon(couponWelcome, 150000);
  assert(res1.valid, 'Valid coupon successfully applied');
  assert(res1.discountRupees === 150, '10% discount calculated accurately as ₹150');
  assert(res1.discountPaise === 15000, 'Discount paise calculated as 15,000');

  // 4b. Max discount cap enforcement
  // Cart subtotal ₹3,000 (300,000 paise) -> 10% would be ₹300, capped at ₹200 (20,000 paise)
  const resCap = await engagementService.validateCoupon(couponWelcome, 300000);
  assert(resCap.valid, 'Valid coupon applied with cap');
  assert(resCap.discountRupees === 200, 'Discount accurately capped at ₹200');

  // 4c. Minimum order spend rejection
  // Cart subtotal ₹800 (80,000 paise) -> min order ₹1,000
  const resMin = await engagementService.validateCoupon(couponWelcome, 80000);
  assert(!resMin.valid, 'Coupon rejected when cart subtotal is below minimum order amount');
  assert(resMin.message.includes('1000') || resMin.message.includes('1,000'), 'Error message states minimum order required');

  // 4d. Expired coupon rejection
  const resExp = await engagementService.validateCoupon(couponExpired, 100000);
  assert(!resExp.valid, 'Expired coupon rejected');
  assert(resExp.message.includes('expired') || resExp.message.includes('no longer active'), 'Error message clarifies coupon has expired');

  // 4e. Non-existent coupon rejection
  const resFake = await engagementService.validateCoupon('NON_EXISTENT_CODE', 100000);
  assert(!resFake.valid, 'Non-existent coupon code rejected');

  // 4f. Usage limit enforcement
  // Record usage on couponFixed (usageLimit = 1)
  await engagementService.recordCouponUsage(couponFixed);
  const resUsed = await engagementService.validateCoupon(couponFixed, 100000);
  assert(!resUsed.valid, 'Coupon rejected after reaching usage limit');
  assert(resUsed.message.includes('usage limit'), 'Error message confirms usage limit reached');

  // ============================================================
  // 5. IN-APP NOTIFICATIONS & CUSTOMER PRIVACY
  // ============================================================
  console.log('\n--- 5. Testing In-App Notification System ---');

  // 5a. Create notifications for Customer A and Customer B
  const notifIdA = crypto.randomUUID();
  const notifIdB = crypto.randomUUID();

  engagementRepository.createNotification({
    id: notifIdA,
    customerId: customerIdA,
    title: 'Order Shipped',
    message: 'Your Kerala artisanal keepsakes have been dispatched via courier.',
    type: 'order_status',
    isRead: 0,
    referenceType: 'order',
    referenceId: orderIdDelivered,
  });

  engagementRepository.createNotification({
    id: notifIdB,
    customerId: customerIdB,
    title: 'Privilege Unlocked',
    message: 'You have been granted a private atelier welcome coupon.',
    type: 'loyalty',
    isRead: 0,
    referenceType: 'loyalty',
  });

  assert(Boolean(notifIdA && notifIdB), 'Created distinct notifications for customer A and B');

  // 5b. Customer privacy / ownership isolation: Customer A sees ONLY their notifications
  const notifsA = await engagementService.getCustomerNotifications(customerIdA);
  assert(notifsA.notifications.length >= 1, 'Customer A retrieved their notifications');
  assert(notifsA.notifications.some((n) => n.id === notifIdA), 'Customer A sees their order shipped notification');
  assert(!notifsA.notifications.some((n) => n.id === notifIdB), 'Customer A CANNOT view Customer B notifications');
  assert(notifsA.unreadCount >= 1, 'Unread count computed accurately');

  // 5c. Mark single notification read
  engagementService.markNotificationAsRead(notifIdA, customerIdA);
  const notifsAAfterRead = await engagementService.getCustomerNotifications(customerIdA);
  const readItem = notifsAAfterRead.notifications.find((n) => n.id === notifIdA);
  assert(readItem?.isRead === true, 'Notification successfully marked as read');

  // 5d. Cross-customer mark read spoofing rejected: Customer A cannot mark Customer B's notification
  engagementService.markNotificationAsRead(notifIdB, customerIdA);
  const notifsB = await engagementService.getCustomerNotifications(customerIdB);
  const itemB = notifsB.notifications.find((n) => n.id === notifIdB);
  assert(itemB?.isRead === false, 'Customer A cannot mark Customer B notification as read');

  // ============================================================
  // 6. CUSTOMER ACTIVITY TRACKING
  // ============================================================
  console.log('\n--- 6. Testing Lightweight Customer Activity Tracking ---');

  engagementService.recordActivity(customerIdA, 'PRODUCT_VIEWED', prodSlug, { category: 'kitchen-dining' });
  engagementService.recordActivity(customerIdA, 'WISHLIST_ADDED', 'coconut-brass-cup');
  engagementService.recordActivity(customerIdA, 'CART_ADDED', prodSlug, { quantity: 1 });

  const events = engagementRepository.findEventsByCustomer(customerIdA);
  assert(events.length >= 3, 'Recorded customer interaction telemetry events');
  assert(events.some((e) => e.event_type === 'PRODUCT_VIEWED'), 'Recorded PRODUCT_VIEWED event');
  assert(events.some((e) => e.event_type === 'WISHLIST_ADDED'), 'Recorded WISHLIST_ADDED event');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n====================================================');
  console.log(`TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
