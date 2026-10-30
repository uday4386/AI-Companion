#!/usr/bin/env node
/**
 * CLI: `npm run seed`          → seed only if the database is empty
 *      `npm run seed -- --force` → wipe demo data and rebuild it
 */
import { seedDatabase } from './index.js';
import { DB_PATH } from '../db.js';
import { DEMO_PASSWORD } from './dataset.js';

const force = process.argv.includes('--force');
const result = seedDatabase({ force });

if (result.skipped) {
  console.log(`Database at ${DB_PATH} already contains data. Re-run with --force to rebuild the demo dataset.`);
} else {
  console.log(`Seeded demo data at ${DB_PATH}`);
  console.log(`  applications: ${result.applications}`);
  console.log(`  users:        ${result.users}`);
  console.log(`  errors:       ${result.errors}`);
  console.log('');
  console.log('Demo sign-ins (password for every account):', DEMO_PASSWORD);
  console.log('  Admin        admin@entt.dev');
  console.log('  Team Member  member@entt.dev');
}
