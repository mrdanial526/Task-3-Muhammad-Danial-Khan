const fs = require('fs');
const db = require('../database/db');
const env = require('../config/env');
const ApiResponse = require('../utils/apiResponse');

class SystemController {
  /**
   * Health Check
   * GET /api/v1/system/health
   */
  static getHealth(req, res, next) {
    try {
      const test = db.queryOne('SELECT datetime(\'now\') AS server_time, 1 + 1 AS health_check');
      return ApiResponse.success(res, {
        status: 'HEALTHY',
        database: 'CONNECTED',
        serverTime: test.server_time,
        version: '1.0.0',
        environment: env.NODE_ENV,
        walEnabled: env.DB_ENABLE_WAL,
        foreignKeysEnabled: env.DB_FOREIGN_KEYS
      }, 'System operational');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Database Integrity Verification
   * GET /api/v1/system/integrity
   */
  static checkIntegrity(req, res, next) {
    try {
      const rawDb = db.getDatabase();
      const integrity = rawDb.prepare('PRAGMA integrity_check').all();
      const foreignKeyViolations = rawDb.prepare('PRAGMA foreign_key_check').all();

      const isHealthy = integrity.length === 1 && integrity[0].integrity_check === 'ok' && foreignKeyViolations.length === 0;

      return ApiResponse.success(res, {
        integrityStatus: integrity[0] ? integrity[0].integrity_check : 'unknown',
        foreignKeyViolationsCount: foreignKeyViolations.length,
        foreignKeyViolations,
        isShieldIntact: isHealthy
      }, isHealthy ? 'All database schema constraints and relational foreign keys are 100% intact' : 'Integrity violations detected');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Database Metrics & Table Row Counts
   * GET /api/v1/system/metrics
   */
  static getMetrics(req, res, next) {
    try {
      const rawDb = db.getDatabase();
      const tables = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

      const tableStats = {};
      let totalRecords = 0;

      for (const t of tables) {
        const countRow = rawDb.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get();
        const count = countRow ? countRow.count : 0;
        tableStats[t.name] = count;
        totalRecords += count;
      }

      let dbFileSize = 0;
      if (fs.existsSync(env.DATABASE_ABSOLUTE_PATH)) {
        dbFileSize = fs.statSync(env.DATABASE_ABSOLUTE_PATH).size;
      }

      return ApiResponse.success(res, {
        totalTables: tables.length,
        totalRecords,
        databaseFileSizeBytes: dbFileSize,
        databaseFileSizeKb: (dbFileSize / 1024).toFixed(2),
        tableCounts: tableStats,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: (process.memoryUsage().rss / (1024 * 1024)).toFixed(2)
      }, 'Database metrics collected');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Schema DDL and Entity Relationships
   * GET /api/v1/system/schema
   */
  static getSchema(req, res, next) {
    try {
      const rawDb = db.getDatabase();
      const schemaSql = rawDb.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();

      return ApiResponse.success(res, schemaSql, 'Schema metadata retrieved');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SystemController;
