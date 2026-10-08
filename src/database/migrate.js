const fs = require('fs');
const path = require('path');
const { getDatabase, close } = require('./db');
const env = require('../config/env');

function runMigrations(options = {}) {
  const db = getDatabase(options.customDbPath);
  const reset = options.reset || process.argv.includes('--reset');

  console.log(`[MIGRATION] Target database: ${options.customDbPath || env.DATABASE_ABSOLUTE_PATH}`);

  if (reset) {
    console.log('[MIGRATION] ⚠️ Reset requested. Dropping all existing tables & views...');
    db.pragma('foreign_keys = OFF');
    const tables = [
      'vault_item_tags',
      'audit_logs',
      'vault_items',
      'vault_folders',
      'user_profiles',
      'users',
      'tags',
      'student_courses',
      'students',
      'courses',
      'orders',
      'customers'
    ];

    for (const table of tables) {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    }

    db.exec('DROP VIEW IF EXISTS v_vault_items_expanded');
    db.exec('DROP VIEW IF EXISTS v_customer_order_summaries');
    db.pragma('foreign_keys = ON');
    console.log('[MIGRATION] ✅ Tables dropped.');
  }

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[MIGRATION] Applying schema DDL...');
  db.exec(schemaSql);

  // Validate integrity
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`[MIGRATION] ✅ Schema created successfully. Active tables (${tables.length}):`, tables.map(t => t.name).join(', '));

  return true;
}

if (require.main === module) {
  try {
    runMigrations();
    close();
    console.log('[MIGRATION] Migration process completed successfully.');
  } catch (err) {
    console.error('[MIGRATION] ❌ Migration failed:', err);
    process.exit(1);
  }
}

module.exports = { runMigrations };
