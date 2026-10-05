import { adminAuthService } from '../src/services/adminAuth.service.js';
import { adminUserRepository } from '../src/repositories/adminUser.repository.js';
import { getDatabase } from '../src/database/index.js';

// Ensure DB is initialized
getDatabase();

async function main() {
  // Parse command line arguments or environment variables
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
    return undefined;
  };

  const email =
    getArg('email') ||
    process.env.ADMIN_BOOTSTRAP_EMAIL ||
    'admin@cococraft.com';

  const password =
    getArg('password') ||
    process.env.ADMIN_BOOTSTRAP_PASSWORD ||
    'CococraftAdmin@2026';

  const displayName =
    getArg('name') ||
    process.env.ADMIN_BOOTSTRAP_NAME ||
    'Master Atelier Admin';

  const role = (getArg('role') as any) || 'admin';

  console.log(`[Admin Bootstrap] Checking account for: ${email}...`);

  const existing = adminUserRepository.findByEmail(email);
  if (existing) {
    console.log(`[Admin Bootstrap] Admin user with email "${email}" already exists (ID: ${existing.id}).`);
    process.exit(0);
  }

  try {
    const user = await adminAuthService.createAdmin(email, password, displayName, role);
    console.log(`✅ [Admin Bootstrap] Successfully created admin account:`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Display Name: ${user.displayName}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Status: Active`);
    process.exit(0);
  } catch (err: any) {
    console.error(`❌ [Admin Bootstrap] Error creating admin user:`, err.message);
    process.exit(1);
  }
}

main();
