const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');

class FolderController {
  static listFolders(req, res, next) {
    try {
      const { userId } = req.query;
      const conditions = [];
      const params = [];

      if (userId) {
        conditions.push('f.user_id = ?');
        params.push(parseInt(userId, 10));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT 
          f.id,
          f.user_id,
          u.username AS owner_username,
          f.name,
          f.description,
          f.color_code AS colorCode,
          f.icon,
          f.is_locked AS isLocked,
          f.created_at AS createdAt,
          f.updated_at AS updatedAt,
          COUNT(i.id) AS itemsCount
        FROM vault_folders f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN vault_items i ON f.id = i.folder_id
        ${whereClause}
        GROUP BY f.id
        ORDER BY f.name ASC
      `;

      const folders = db.query(sql, params);
      return ApiResponse.success(res, folders, 'Folders retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  static getFolderById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Folder ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const folderSql = `
        SELECT 
          f.id,
          f.user_id,
          u.username AS owner_username,
          f.name,
          f.description,
          f.color_code AS colorCode,
          f.icon,
          f.is_locked AS isLocked,
          f.created_at AS createdAt,
          f.updated_at AS updatedAt
        FROM vault_folders f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = ?
      `;

      const folder = db.queryOne(folderSql, [id]);
      if (!folder) {
        return ApiResponse.error(res, `Folder with ID ${id} not found`, 404, 'FOLDER_NOT_FOUND');
      }

      // Fetch items in this folder (1:Many)
      const itemsSql = `
        SELECT id, title, secret_type AS secretType, sensitivity_score AS sensitivityScore, created_at AS createdAt
        FROM vault_items
        WHERE folder_id = ?
        ORDER BY created_at DESC
      `;
      const items = db.query(itemsSql, [id]);

      folder.items = items;
      folder.itemsCount = items.length;

      return ApiResponse.success(res, folder, 'Folder retrieved');
    } catch (err) {
      next(err);
    }
  }

  static createFolder(req, res, next) {
    try {
      const { userId, name, description, colorCode, icon, isLocked } = req.body;

      const user = db.queryOne('SELECT id FROM users WHERE id = ?', [userId]);
      if (!user) {
        return ApiResponse.error(res, `Foreign Key Violation: User ID ${userId} does not exist`, 404, 'USER_NOT_FOUND');
      }

      const insertSql = `
        INSERT INTO vault_folders (user_id, name, description, color_code, icon, is_locked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      const result = db.execute(insertSql, [userId, name, description || null, colorCode || '#3B82F6', icon || 'folder-key', isLocked || 0]);

      const created = db.queryOne('SELECT * FROM vault_folders WHERE id = ?', [result.lastInsertRowid]);
      return ApiResponse.created(res, created, 'Vault folder created successfully');
    } catch (err) {
      next(err);
    }
  }

  static updateFolder(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Folder ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT id FROM vault_folders WHERE id = ?', [id]);
      if (!existing) {
        return ApiResponse.error(res, `Folder with ID ${id} not found`, 404, 'FOLDER_NOT_FOUND');
      }

      const { name, description, colorCode, icon, isLocked } = req.body;
      const updates = [];
      const params = [];

      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (colorCode !== undefined) { updates.push('color_code = ?'); params.push(colorCode); }
      if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
      if (isLocked !== undefined) { updates.push('is_locked = ?'); params.push(isLocked); }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        const sql = `UPDATE vault_folders SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);
        db.execute(sql, params);
      }

      const updated = db.queryOne('SELECT * FROM vault_folders WHERE id = ?', [id]);
      return ApiResponse.success(res, updated, 'Folder updated');
    } catch (err) {
      next(err);
    }
  }

  static deleteFolder(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Folder ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT name FROM vault_folders WHERE id = ?', [id]);
      if (!existing) {
        return ApiResponse.error(res, `Folder with ID ${id} not found`, 404, 'FOLDER_NOT_FOUND');
      }

      // Foreign key is configured ON DELETE SET NULL on vault_items
      db.execute('DELETE FROM vault_folders WHERE id = ?', [id]);
      return ApiResponse.success(res, { deletedFolderId: id, name: existing.name }, `Folder "${existing.name}" deleted (contained items unlinked)`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = FolderController;
