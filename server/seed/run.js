#!/usr/bin/env node
/**
 * CLI
 *   npm run seed             → create the admin account if the workspace is empty
 *   npm run seed -- --reset  → delete everything and recreate just the admin
 *
 * There is no demo dataset: an empty workspace contains one administrator.
 */
import { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_USERNAME, bootstrapWorkspace, ensureAdmin, isEmpty } from './index.js';
import { DB_PATH } from '../db.js';

const reset = process.argv.includes('--reset') || process.argv.includes('--force');

if (!reset && !isEmpty()) {
  console.log(`Workspace at ${DB_PATH} already has accounts — nothing to do.`);
  console.log('Re-run with --reset to delete all data and recreate the admin account.');
  process.exit(0);
}

const result = reset ? bootstrapWorkspace() : ensureAdmin();

if (!result.created) {
  console.log(`Workspace at ${DB_PATH} already has accounts — nothing to do.`);
  process.exit(0);
}

console.log(`${reset ? 'Reset workspace' : 'Created workspace'} at ${DB_PATH}`);
console.log('  reports:      0');
console.log('  applications: 0');
console.log('  users:        1 (admin)');
console.log('');
console.log('Admin sign-in');
console.log(`  Username  ${ADMIN_USERNAME}`);
console.log(`  Email     ${ADMIN_EMAIL}`);
console.log(`  Password  ${ADMIN_PASSWORD}`);
console.log(`  Name      ${ADMIN_NAME}`);
