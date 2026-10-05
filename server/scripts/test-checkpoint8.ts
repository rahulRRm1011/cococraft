import crypto from 'crypto';
import { getDatabase } from '../src/database/index.js';
import { customerRepository } from '../src/repositories/customer.repository.js';
import { orderRepository } from '../src/repositories/order.repository.js';
import { customerAuthService } from '../src/services/customerAuth.service.js';
import { customerAccountService } from '../src/services/customerAccount.service.js';

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
  console.log('🧪 COCOCRAFT CHECKPOINT 8 BACKEND TEST SUITE');
  console.log('🧪 CUSTOMER ACCOUNTS, SESSIONS, ORDERS & ADDRESS BOOK');
  console.log('🧪 ====================================================\n');

  // --- 1. Customer Registration & Password Security ---
  console.log('--- 1. Testing Customer Registration & Password Security ---');
  const timestamp = Date.now();
  const testEmailA = `arjun.sharma_${timestamp}@example.com`;
  const rawPasswordA = 'CocoArtisan#2026';

  // 1a. Weak password rejection
  let weakPasswordCaught = false;
  try {
    await customerAuthService.register({
      name: 'Arjun Sharma',
      email: testEmailA,
      password: 'short',
    });
  } catch (err: any) {
    weakPasswordCaught = true;
    assert(err.message.includes('8 characters'), 'Rejects password shorter than 8 characters');
  }
  assert(weakPasswordCaught, 'Weak password validation enforced');

  // 1b. Successful registration
  const regResultA = await customerAuthService.register({
    name: 'Arjun Sharma',
    email: testEmailA,
    password: rawPasswordA,
    phone: '9876543210',
  });

  assert(Boolean(regResultA.customer.id), 'Customer ID is generated on registration');
  assert(regResultA.customer.email === testEmailA, 'Customer email is stored in lowercase');
  assert(regResultA.customer.name === 'Arjun Sharma', 'Customer name is stored');
  assert((regResultA.customer as any).password_hash === undefined, 'Customer DTO never leaks password_hash');
  assert(Boolean(regResultA.token), 'Session token is returned on registration');

  const customerRecordA = customerRepository.findCustomerById(regResultA.customer.id)!;
  assert(customerRecordA.password_hash !== rawPasswordA, 'Password is NOT stored in plain text');
  assert(customerRecordA.password_hash.startsWith('$2'), 'Password is encrypted using bcrypt');

  // 1c. Duplicate account rejection
  let duplicateCaught = false;
  try {
    await customerAuthService.register({
      name: 'Another Arjun',
      email: testEmailA,
      password: rawPasswordA,
    });
  } catch (err: any) {
    duplicateCaught = true;
    assert(err.message.includes('already exists'), 'Duplicate email registration is blocked');
  }
  assert(duplicateCaught, 'Duplicate account check enforced');

  // --- 2. Customer Authentication & Sessions ---
  console.log('\n--- 2. Testing Customer Authentication & Sessions ---');

  // 2a. Wrong password rejection
  let wrongPasswordCaught = false;
  try {
    await customerAuthService.login({
      email: testEmailA,
      password: 'WrongPassword99',
    });
  } catch (err: any) {
    wrongPasswordCaught = true;
    assert(err.message === 'Invalid email or password.', 'Wrong password produces generic error (no enumeration)');
  }
  assert(wrongPasswordCaught, 'Wrong password login rejected');

  // 2b. Unknown email rejection
  let unknownEmailCaught = false;
  try {
    await customerAuthService.login({
      email: 'nonexistent_customer@example.com',
      password: rawPasswordA,
    });
  } catch (err: any) {
    unknownEmailCaught = true;
    assert(err.message === 'Invalid email or password.', 'Unknown email produces exact same generic error');
  }
  assert(unknownEmailCaught, 'Unknown email login rejected without revealing user existence');

  // 2c. Successful login
  const loginResultA = await customerAuthService.login({
    email: testEmailA,
    password: rawPasswordA,
  });

  assert(loginResultA.customer.id === regResultA.customer.id, 'Login returns matching customer identity');
  assert(Boolean(loginResultA.token), 'New session token generated on login');

  // 2d. Validate session token
  const validatedCustomer = customerAuthService.validateToken(loginResultA.token);
  assert(Boolean(validatedCustomer), 'Valid session token resolves to customer record');
  assert(validatedCustomer?.id === regResultA.customer.id, 'Session token resolves to correct customer');

  // 2e. Inactive customer login prevention
  db.prepare(`UPDATE customers SET status = 'inactive' WHERE id = ?`).run(regResultA.customer.id);
  let inactiveCaught = false;
  try {
    await customerAuthService.login({
      email: testEmailA,
      password: rawPasswordA,
    });
  } catch (err: any) {
    inactiveCaught = true;
    assert(err.message === 'Invalid email or password.', 'Inactive customer login rejected');
  }
  assert(inactiveCaught, 'Inactive customer prevention verified');

  // Restore active status
  db.prepare(`UPDATE customers SET status = 'active' WHERE id = ?`).run(regResultA.customer.id);

  // --- 3. Profile Management ---
  console.log('\n--- 3. Testing Customer Profile Management ---');
  const profile = await customerAccountService.getProfile(regResultA.customer.id);
  assert(profile.email === testEmailA, 'Customer can view their profile email');

  // 3a. Update name and phone
  const updatedProfile = await customerAccountService.updateProfile(regResultA.customer.id, {
    name: 'Arjun S. Craft',
    phone: '9845012345',
  });
  assert(updatedProfile.name === 'Arjun S. Craft', 'Customer can update their display name');
  assert(updatedProfile.phone === '9845012345', 'Customer can update their phone number');

  // 3b. Change password
  const newPasswordA = 'NewArtisanPass#2026';
  await customerAccountService.changePassword(regResultA.customer.id, {
    currentPassword: rawPasswordA,
    newPassword: newPasswordA,
  });

  const updatedCustomerRecord = customerRepository.findCustomerById(regResultA.customer.id)!;
  const newPassVerified = await customerAuthService.verifyPassword(newPasswordA, updatedCustomerRecord.password_hash);
  assert(newPassVerified === true, 'Customer password successfully updated with new bcrypt hash');

  // --- 4. Customer Address Book ---
  console.log('\n--- 4. Testing Customer Address Book ---');

  // 4a. Add first address (should auto-become default)
  const addr1 = await customerAccountService.createAddress(regResultA.customer.id, {
    name: 'Arjun Sharma Home',
    phone: '9876543210',
    addressLine1: '42 Coconut Grove, Beach Road',
    addressLine2: 'Near Lighthouse',
    city: 'Kochi',
    state: 'Kerala',
    postalCode: '682001',
    country: 'India',
  });

  assert(Boolean(addr1.id), 'Address ID generated');
  assert(addr1.isDefault === true, 'First address automatically assigned as default');
  assert(addr1.city === 'Kochi', 'Address city stored correctly');

  // 4b. Add second address with isDefault: true (should unset first address default)
  const addr2 = await customerAccountService.createAddress(regResultA.customer.id, {
    name: 'Arjun Studio Office',
    phone: '9876543210',
    addressLine1: '108 Artisan Lane, Mattancherry',
    city: 'Kochi',
    state: 'Kerala',
    postalCode: '682002',
    isDefault: true,
  });

  assert(addr2.isDefault === true, 'Second address set as default');
  const allAddressesAfter2 = await customerAccountService.getAddresses(regResultA.customer.id);
  assert(allAddressesAfter2.length === 2, 'Customer has 2 saved addresses');
  const addr1Refreshed = allAddressesAfter2.find((a) => a.id === addr1.id)!;
  assert(addr1Refreshed.isDefault === false, 'First address default was cleared when second address became default');

  // 4c. Update address
  const updatedAddr1 = await customerAccountService.updateAddress(regResultA.customer.id, addr1.id, {
    name: 'Arjun Sharma Residence',
  });
  assert(updatedAddr1.name === 'Arjun Sharma Residence', 'Address name successfully updated');

  // 4d. Delete address
  await customerAccountService.deleteAddress(regResultA.customer.id, addr2.id);
  const allAddressesAfterDel = await customerAccountService.getAddresses(regResultA.customer.id);
  assert(allAddressesAfterDel.length === 1, 'Address successfully removed');
  assert(allAddressesAfterDel[0].isDefault === true, 'Remaining address promoted to default');

  // --- 5. Guest Order Linking ---
  console.log('\n--- 5. Testing Guest Order Linking ---');
  const guestEmail = `guest_buyer_${timestamp}@example.com`;
  const guestOrderId = `ord_guest_${timestamp}`;
  const guestOrderNumber = `CC-2026-990001`;

  // Create an unassigned guest order in DB with customer_id = NULL
  db.prepare(`
    INSERT INTO orders (
      id, order_number, access_token, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_city, delivery_state, delivery_postal_code, delivery_country,
      subtotal_paise, shipping_paise, discount_paise, tax_paise, grand_total_paise,
      currency, payment_method, payment_status, order_status, customer_id
    ) VALUES (
      ?, ?, 'tok_guest', 'Guest Buyer', ?, '9876543210',
      '12 Palm View', 'Kochi', 'Kerala', '682001', 'India',
      120000, 0, 0, 0, 120000,
      'INR', 'cod', 'unpaid', 'confirmed', NULL
    )
  `).run(guestOrderId, guestOrderNumber, guestEmail);

  // Snapshot an item for this order
  db.prepare(`
    INSERT INTO order_items (
      order_id, product_document_id, product_slug, product_name, sku,
      quantity, unit_price_paise, line_total_paise
    ) VALUES (
      ?, 'doc_coconut_bowl', 'handcrafted-coconut-bowl', 'Handcrafted Coconut Bowl', 'CC-BOWL-01',
      2, 60000, 120000
    )
  `).run(guestOrderId);

  // Now customer registers with the same email
  const regGuest = await customerAuthService.register({
    name: 'Former Guest Now Member',
    email: guestEmail,
    password: 'ArtisanMember#2026',
  });

  // Verify historical guest order is automatically linked!
  const linkedOrder = orderRepository.findOrderById(guestOrderId)!;
  assert(linkedOrder.customer_id === regGuest.customer.id, 'Historical guest order customer_id is linked to new customer account');

  // Verify customer can retrieve the order in their account order history
  const customerOrders = await customerAccountService.getCustomerOrders(regGuest.customer.id);
  assert(customerOrders.length === 1, 'Linked guest order appears in customer order history');
  assert(customerOrders[0].orderNumber === guestOrderNumber, 'Order number matches linked guest order');
  assert(customerOrders[0].grandTotal === 1200, 'Grand total matches in rupees');

  // --- 6. Order Ownership Security & Isolation ---
  console.log('\n--- 6. Testing Order Ownership Security & Cross-Customer Isolation ---');

  // Register Customer B
  const testEmailB = `priya.nair_${timestamp}@example.com`;
  const regCustomerB = await customerAuthService.register({
    name: 'Priya Nair',
    email: testEmailB,
    password: 'PriyaArtisan#2026',
  });

  // Customer B attempts to access Customer A's order (guestOrderId)
  let unauthorizedOrderAccessCaught = false;
  try {
    await customerAccountService.getCustomerOrderDetail(regCustomerB.customer.id, guestOrderId);
  } catch (err: any) {
    unauthorizedOrderAccessCaught = true;
    assert(err.message === 'Order not found.', 'Returns 404 without leaking order existence to Customer B');
  }
  assert(unauthorizedOrderAccessCaught, 'Customer B cannot access Customer A order');

  // Customer A accesses their own order
  const orderDetail = await customerAccountService.getCustomerOrderDetail(regGuest.customer.id, guestOrderId);
  assert(orderDetail.orderNumber === guestOrderNumber, 'Owner can access their order detail');
  assert(orderDetail.items.length === 1, 'Items snapshot returned to owner');
  assert(orderDetail.timeline.length > 0, 'Customer-friendly timeline provided');
  assert((orderDetail as any).internal_notes === undefined, 'No admin notes leaked');
  assert((orderDetail as any).failure_code === undefined, 'No payment failure codes leaked');

  // --- 7. Session Invalidation & Logout ---
  console.log('\n--- 7. Testing Session Invalidation & Logout ---');
  customerAuthService.logout(regGuest.token);
  const postLogoutValidation = customerAuthService.validateToken(regGuest.token);
  assert(postLogoutValidation === null, 'Session token is invalidated after logout');

  // Cleanup test data
  db.prepare(`DELETE FROM customers WHERE email LIKE '%@example.com' OR email LIKE '%@cococraft.com'`).run();
  db.prepare(`DELETE FROM orders WHERE id = ?`).run(guestOrderId);

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
