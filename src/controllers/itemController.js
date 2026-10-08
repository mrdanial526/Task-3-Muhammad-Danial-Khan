const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');
const { maskSecret } = require('../utils/crypto');

class ItemController {
  /**
   * Helper to fetch complete item by ID
   */
  static fetchItemRecord(id, reveal = true) {
    const dataSql = `
      SELECT 
        i.id,
        i.user_id,
        u.username AS owner_username,
        u.email AS owner_email,
        p.clearance_level AS owner_clearance,
        i.folder_id,
        f.name AS folder_name,
        f.color_code AS folder_color,
        i.title,
        i.secret_type,
        i.encrypted_payload,
        i.sensitivity_score,
        i.expires_at,
        i.created_at,
        i.updated_at
      FROM vault_items i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN vault_folders f ON i.folder_id = f.id
      WHERE i.id = ?
    `;

    const row = db.queryOne(dataSql, [id]);
    if (!row) return null;

    const tagsSql = `
      SELECT t.id, t.name, t.color_hex AS colorHex, vit.assigned_at AS assignedAt
      FROM vault_item_tags vit
      JOIN tags t ON vit.tag_id = t.id
      WHERE vit.vault_item_id = ?
    `;
    const tags = db.query(tagsSql, [id]);

    return {
      id: row.id,
      userId: row.user_id,
      owner: {
        username: row.owner_username,
        email: row.owner_email,
        clearanceLevel: row.owner_clearance
      },
      folder: row.folder_id ? {
        id: row.folder_id,
        name: row.folder_name,
        colorCode: row.folder_color
      } : null,
      title: row.title,
      secretType: row.secret_type,
      payload: reveal ? row.encrypted_payload : maskSecret(row.encrypted_payload, 12),
      isMasked: !reveal,
      sensitivityScore: row.sensitivity_score,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags
    };
  }

  /**
   * List all vault items with filtering, search, and joined tags (M:M)
   * GET /api/v1/items
   */
  static listItems(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const {
        userId,
        folderId,
        secretType,
        tagId,
        tagName,
        minSensitivity,
        maxSensitivity,
        search,
        reveal = 'false'
      } = req.query;

      const conditions = [];
      const params = [];

      if (userId) {
        conditions.push('i.user_id = ?');
        params.push(parseInt(userId, 10));
      }

      if (folderId !== undefined) {
        if (folderId === 'null' || folderId === '') {
          conditions.push('i.folder_id IS NULL');
        } else {
          conditions.push('i.folder_id = ?');
          params.push(parseInt(folderId, 10));
        }
      }

      if (secretType) {
        conditions.push('i.secret_type = ?');
        params.push(secretType);
      }

      if (minSensitivity) {
        conditions.push('i.sensitivity_score >= ?');
        params.push(parseInt(minSensitivity, 10));
      }

      if (maxSensitivity) {
        conditions.push('i.sensitivity_score <= ?');
        params.push(parseInt(maxSensitivity, 10));
      }

      if (tagId) {
        conditions.push('EXISTS (SELECT 1 FROM vault_item_tags vit WHERE vit.vault_item_id = i.id AND vit.tag_id = ?)');
        params.push(parseInt(tagId, 10));
      }

      if (tagName) {
        conditions.push('EXISTS (SELECT 1 FROM vault_item_tags vit JOIN tags t ON vit.tag_id = t.id WHERE vit.vault_item_id = i.id AND t.name = ?)');
        params.push(tagName);
      }

      if (search) {
        conditions.push('(i.title LIKE ? OR f.name LIKE ? OR u.username LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Total count
      const countSql = `
        SELECT COUNT(*) AS total
        FROM vault_items i
        JOIN users u ON i.user_id = u.id
        LEFT JOIN vault_folders f ON i.folder_id = f.id
        ${whereClause}
      `;
      const countRow = db.queryOne(countSql, params);
      const total = countRow ? countRow.total : 0;

      // Data query with JSON aggregated tags
      const dataSql = `
        SELECT 
          i.id,
          i.user_id,
          u.username AS owner_username,
          i.folder_id,
          f.name AS folder_name,
          f.color_code AS folder_color,
          i.title,
          i.secret_type,
          i.encrypted_payload,
          i.sensitivity_score,
          i.expires_at,
          i.created_at,
          i.updated_at,
          (
            SELECT json_group_array(
              json_object(
                'id', t.id,
                'name', t.name,
                'colorHex', t.color_hex,
                'assignedAt', vit.assigned_at
              )
            )
            FROM vault_item_tags vit
            JOIN tags t ON vit.tag_id = t.id
            WHERE vit.vault_item_id = i.id
          ) AS tags_json
        FROM vault_items i
        JOIN users u ON i.user_id = u.id
        LEFT JOIN vault_folders f ON i.folder_id = f.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const rows = db.query(dataSql, [...params, limit, offset]);
      const shouldReveal = reveal === 'true';

      const formatted = rows.map((r) => {
        let tags = [];
        try {
          tags = r.tags_json ? JSON.parse(r.tags_json) : [];
        } catch {
          tags = [];
        }

        return {
          id: r.id,
          userId: r.user_id,
          ownerUsername: r.owner_username,
          folder: r.folder_id ? {
            id: r.folder_id,
            name: r.folder_name,
            colorCode: r.folder_color
          } : null,
          title: r.title,
          secretType: r.secret_type,
          payload: shouldReveal ? r.encrypted_payload : maskSecret(r.encrypted_payload, 12),
          sensitivityScore: r.sensitivity_score,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          tags
        };
      });

      return ApiResponse.paginated(res, formatted, { page, limit, total }, 'Vault items retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single vault item by ID
   * GET /api/v1/items/:id
   */
  static getItemById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Item ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const shouldReveal = req.query.reveal === 'true';
      const item = ItemController.fetchItemRecord(id, shouldReveal);

      if (!item) {
        return ApiResponse.error(res, `Vault item with ID ${id} not found`, 404, 'ITEM_NOT_FOUND');
      }

      return ApiResponse.success(res, item, 'Vault item retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create new vault item and link tags (Atomic M:M Transaction)
   * POST /api/v1/items
   */
  static createItem(req, res, next) {
    try {
      const { userId, folderId, title, secretType, payload, sensitivityScore, expiresAt, tagIds = [] } = req.body;

      const itemId = db.transaction(() => {
        // 1. Verify user existence
        const user = db.queryOne('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) {
          const err = new Error(`Foreign Key Violation: User with ID ${userId} does not exist.`);
          err.statusCode = 404;
          err.errorCategory = 'USER_NOT_FOUND';
          throw err;
        }

        // 2. Verify folder existence if provided
        if (folderId) {
          const folder = db.queryOne('SELECT id, user_id FROM vault_folders WHERE id = ?', [folderId]);
          if (!folder) {
            const err = new Error(`Foreign Key Violation: Folder with ID ${folderId} does not exist.`);
            err.statusCode = 404;
            err.errorCategory = 'FOLDER_NOT_FOUND';
            throw err;
          }
        }

        // 3. Insert vault item
        const insertItemStmt = db.prepare(`
          INSERT INTO vault_items (user_id, folder_id, title, secret_type, encrypted_payload, sensitivity_score, expires_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        const itemRes = insertItemStmt.run(
          userId,
          folderId || null,
          title,
          secretType,
          payload,
          sensitivityScore,
          expiresAt || null
        );
        const newItemId = itemRes.lastInsertRowid;

        // 4. Insert junction records in vault_item_tags (M:M)
        if (tagIds && tagIds.length > 0) {
          const insertTagStmt = db.prepare(`
            INSERT OR IGNORE INTO vault_item_tags (vault_item_id, tag_id, assigned_at)
            VALUES (?, ?, datetime('now'))
          `);
          for (const tagId of tagIds) {
            insertTagStmt.run(newItemId, tagId);
          }
        }

        // 5. Create audit log
        const insertAudit = db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, status, details)
          VALUES (?, 'SECRET_STORED', 'VAULT_ITEM', ?, ?, 'SUCCESS', ?)
        `);
        insertAudit.run(userId, newItemId, req.ip || '127.0.0.1', `Stored secret: "${title}"`);

        return newItemId;
      });

      const item = ItemController.fetchItemRecord(itemId, true);
      return ApiResponse.created(res, item, 'Vault item and tags stored successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update vault item and synchronize M:M tags
   * PUT/PATCH /api/v1/items/:id
   */
  static updateItem(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Item ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT * FROM vault_items WHERE id = ?', [id]);
      if (!existing) {
        return ApiResponse.error(res, `Vault item with ID ${id} not found`, 404, 'ITEM_NOT_FOUND');
      }

      const { folderId, title, secretType, payload, sensitivityScore, expiresAt, tagIds } = req.body;

      db.transaction(() => {
        const updates = [];
        const params = [];

        if (folderId !== undefined) {
          updates.push('folder_id = ?');
          params.push(folderId);
        }
        if (title !== undefined) {
          updates.push('title = ?');
          params.push(title);
        }
        if (secretType !== undefined) {
          updates.push('secret_type = ?');
          params.push(secretType);
        }
        if (payload !== undefined) {
          updates.push('encrypted_payload = ?');
          params.push(payload);
        }
        if (sensitivityScore !== undefined) {
          updates.push('sensitivity_score = ?');
          params.push(sensitivityScore);
        }
        if (expiresAt !== undefined) {
          updates.push('expires_at = ?');
          params.push(expiresAt);
        }

        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          const sql = `UPDATE vault_items SET ${updates.join(', ')} WHERE id = ?`;
          params.push(id);
          db.execute(sql, params);
        }

        // Synchronize M:M junction tags if tagIds array is provided
        if (Array.isArray(tagIds)) {
          // Remove obsolete tags
          db.execute('DELETE FROM vault_item_tags WHERE vault_item_id = ?', [id]);

          // Insert newly assigned tags
          if (tagIds.length > 0) {
            const insertStmt = db.prepare('INSERT OR IGNORE INTO vault_item_tags (vault_item_id, tag_id) VALUES (?, ?)');
            for (const tId of tagIds) {
              insertStmt.run(id, tId);
            }
          }
        }
      });

      const item = ItemController.fetchItemRecord(id, true);
      return ApiResponse.success(res, item, 'Vault item updated');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete vault item (cascades junction rows in vault_item_tags)
   * DELETE /api/v1/items/:id
   */
  static deleteItem(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Item ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT title, user_id FROM vault_items WHERE id = ?', [id]);
      if (!existing) {
        return ApiResponse.error(res, `Vault item with ID ${id} not found`, 404, 'ITEM_NOT_FOUND');
      }

      db.transaction(() => {
        db.execute('DELETE FROM vault_items WHERE id = ?', [id]);

        const insertAudit = db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, status, details)
          VALUES (?, 'SECRET_DELETED', 'VAULT_ITEM', ?, ?, 'SUCCESS', ?)
        `);
        insertAudit.run(existing.user_id, id, req.ip || '127.0.0.1', `Deleted secret "${existing.title}"`);
      });

      return ApiResponse.success(
        res,
        { deletedItemId: id, title: existing.title },
        `Vault item "${existing.title}" deleted and junction links cleaned up`
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ItemController;
