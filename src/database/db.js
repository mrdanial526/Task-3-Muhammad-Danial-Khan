const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

let instance = null;
let currentPath = null;

/**
 * Get or initialize the SQLite database connection
 * @param {string} [customPath] Optional custom DB path (e.g. for testing)
 * @returns {Database}
 */
function getDatabase(customPath) {
  const targetRelative = customPath || process.env.DATABASE_PATH || env.DATABASE_PATH;
  const dbPath = path.isAbsolute(targetRelative)
    ? targetRelative
    : path.resolve(process.cwd(), targetRelative);

  if (instance && currentPath === dbPath && !customPath) {
    return instance;
  }

  if (instance) {
    try { instance.close(); } catch {}
    instance = null;
  }

  // Ensure directory exists for file-based DB
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, {
    verbose: env.LOG_LEVEL === 'debug' ? (msg) => console.log(`[SQL TRACE] ${msg}`) : null
  });

  // Pillar 4: Enforce Foreign Key Integrity strictly at engine level
  db.pragma('foreign_keys = ON');

  // WAL Mode for high concurrency and crash durability
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Optimize performance settings
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  instance = db;
  currentPath = dbPath;

  return db;
}

/**
 * Execute a parameterized SELECT query returning all matching rows
 */
function query(sql, params = []) {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
    return rows;
  } catch (err) {
    throw enhanceSqliteError(err, sql, params);
  }
}

/**
 * Execute a parameterized SELECT query returning a single row or null
 */
function queryOne(sql, params = []) {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
    return row || null;
  } catch (err) {
    throw enhanceSqliteError(err, sql, params);
  }
}

/**
 * Execute a parameterized INSERT / UPDATE / DELETE statement
 */
function execute(sql, params = []) {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    const result = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
    return result;
  } catch (err) {
    throw enhanceSqliteError(err, sql, params);
  }
}

/**
 * Prepare statement directly on active database
 */
function prepare(sql) {
  return getDatabase().prepare(sql);
}

/**
 * Execute raw multi-statement SQL
 */
function exec(sql) {
  return getDatabase().exec(sql);
}

/**
 * Execute PRAGMA command
 */
function pragma(pragmaName, options) {
  return getDatabase().pragma(pragmaName, options);
}

/**
 * Execute a callback within an ACID Transaction
 */
function transaction(callback) {
  const db = getDatabase();
  const runTx = db.transaction((...args) => {
    return callback(db, ...args);
  });
  try {
    return runTx();
  } catch (err) {
    throw enhanceSqliteError(err, 'TRANSACTION_BLOCK', []);
  }
}

/**
 * Translates SQLite constraint violations into clean, actionable application errors
 */
function enhanceSqliteError(err, sql, params) {
  if (err.statusCode && err.errorCategory) {
    return err;
  }

  const message = err.message || '';
  const enhanced = new Error(message);
  enhanced.originalError = err;
  enhanced.sql = sql;
  enhanced.params = params;

  if (message.includes('UNIQUE constraint failed')) {
    enhanced.statusCode = 409;
    enhanced.errorCategory = 'UNIQUE_CONSTRAINT_VIOLATION';
    const match = message.match(/UNIQUE constraint failed: ([\w.]+)/);
    enhanced.target = match ? match[1] : 'field';
    enhanced.message = `Integrity Shield: Record with this ${enhanced.target} already exists.`;
  } else if (message.includes('NOT NULL constraint failed')) {
    enhanced.statusCode = 400;
    enhanced.errorCategory = 'NOT_NULL_CONSTRAINT_VIOLATION';
    const match = message.match(/NOT NULL constraint failed: ([\w.]+)/);
    enhanced.target = match ? match[1] : 'required field';
    enhanced.message = `Integrity Shield: Missing required non-null value for ${enhanced.target}.`;
  } else if (message.includes('CHECK constraint failed')) {
    enhanced.statusCode = 422;
    enhanced.errorCategory = 'CHECK_CONSTRAINT_VIOLATION';
    enhanced.message = `Integrity Shield: Value violates database CHECK constraint. Data rejected by schema.`;
  } else if (message.includes('FOREIGN KEY constraint failed')) {
    enhanced.statusCode = 409;
    enhanced.errorCategory = 'FOREIGN_KEY_CONSTRAINT_VIOLATION';
    enhanced.message = `Integrity Shield: Relational reference integrity violation. Referenced parent does not exist or child records prevent deletion.`;
  } else {
    enhanced.statusCode = 500;
    enhanced.errorCategory = 'DATABASE_ERROR';
  }

  return enhanced;
}

/**
 * Close database connection
 */
function close() {
  if (instance) {
    try {
      instance.close();
    } catch {}
    instance = null;
    currentPath = null;
  }
}

module.exports = {
  getDatabase,
  query,
  queryOne,
  execute,
  prepare,
  exec,
  pragma,
  transaction,
  enhanceSqliteError,
  close
};
