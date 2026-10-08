const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');

class SecurityController {
  /**
   * Interactive SQL Injection Defense Simulator
   * POST /api/v1/security/injection-sandbox
   */
  static testInjectionSandbox(req, res, next) {
    try {
      const { searchInput = "' OR '1'='1" } = req.body;

      // 1. Safe Parameterized Query (The Shield)
      const parameterizedSql = 'SELECT id, username, email, role, status FROM users WHERE username = ?';
      const safeResults = db.query(parameterizedSql, [searchInput]);

      // 2. Simulated Unsafe Query (for educational visualization only, not executed)
      const simulatedUnsafeSql = `SELECT id, username, email, role, status FROM users WHERE username = '${searchInput}'`;

      const analysis = {
        attackPayload: searchInput,
        defenseMechanism: 'Precompiled Parameterized Prepared Statement (better-sqlite3)',
        safeExecution: {
          sql: parameterizedSql,
          parameterBound: [searchInput],
          rowsReturned: safeResults.length,
          results: safeResults,
          explanation: 'The database engine treats the input solely as literal string data. Quotes and SQL keywords inside the parameter are never interpreted as executable grammar or syntax.'
        },
        unsafeSimulation: {
          constructedSql: simulatedUnsafeSql,
          vulnerabilityRisk: searchInput.includes("'") || searchInput.includes("--") || searchInput.includes(";") ? 'CRITICAL_INJECTION_VULNERABILITY' : 'LOW_RISK',
          hazardDescription: 'If concatenated dynamically into raw SQL, this string alters the query abstract syntax tree (AST), allowing an attacker to bypass authentication or extract sensitive records.'
        },
        verdict: '🛡️ SECURE: Parameterization guaranteed zero SQL injection vulnerability.'
      };

      return ApiResponse.success(res, analysis, 'SQL Injection Defense Test Completed');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Inspect all database constraints dynamically
   * GET /api/v1/security/constraints
   */
  static inspectConstraints(req, res, next) {
    try {
      const rawDb = db.getDatabase();
      const tables = rawDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

      const constraintReport = tables.map((t) => {
        const columns = rawDb.prepare(`PRAGMA table_info(${t.name})`).all();
        const foreignKeys = rawDb.prepare(`PRAGMA foreign_key_list(${t.name})`).all();

        // Extract check constraints and unique constraints from SQL DDL
        const checks = [];
        const checkMatches = t.sql.matchAll(/CHECK\s*\(([^)]+)\)/gi);
        for (const m of checkMatches) {
          checks.push(m[1].trim());
        }

        return {
          table: t.name,
          primaryKeys: columns.filter((c) => c.pk > 0).map((c) => c.name),
          notNullColumns: columns.filter((c) => c.notnull === 1).map((c) => c.name),
          foreignKeys: foreignKeys.map((fk) => ({
            column: fk.from,
            referencesTable: fk.table,
            referencesColumn: fk.to,
            onDelete: fk.on_delete,
            onUpdate: fk.on_update
          })),
          checkConstraints: checks,
          rawDdl: t.sql
        };
      });

      return ApiResponse.success(res, constraintReport, 'Database schema constraints inspected');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SecurityController;
