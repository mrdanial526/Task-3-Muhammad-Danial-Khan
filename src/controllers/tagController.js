const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');

class TagController {
  static listTags(req, res, next) {
    try {
      const sql = `
        SELECT 
          t.id,
          t.name,
          t.color_hex AS colorHex,
          t.created_at AS createdAt,
          COUNT(vit.vault_item_id) AS itemsCount
        FROM tags t
        LEFT JOIN vault_item_tags vit ON t.id = vit.tag_id
        GROUP BY t.id
        ORDER BY t.name ASC
      `;

      const tags = db.query(sql);
      return ApiResponse.success(res, tags, 'Tags retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  static createTag(req, res, next) {
    try {
      const { name, colorHex } = req.body;
      const sql = 'INSERT INTO tags (name, color_hex, created_at) VALUES (?, ?, datetime(\'now\'))';
      const result = db.execute(sql, [name, colorHex || '#10B981']);

      const tag = db.queryOne('SELECT id, name, color_hex AS colorHex, created_at AS createdAt FROM tags WHERE id = ?', [result.lastInsertRowid]);
      return ApiResponse.created(res, tag, 'Tag created');
    } catch (err) {
      next(err);
    }
  }

  static deleteTag(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Tag ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const tag = db.queryOne('SELECT name FROM tags WHERE id = ?', [id]);
      if (!tag) {
        return ApiResponse.error(res, `Tag with ID ${id} not found`, 404, 'TAG_NOT_FOUND');
      }

      // Foreign key in vault_item_tags is ON DELETE CASCADE
      db.execute('DELETE FROM tags WHERE id = ?', [id]);
      return ApiResponse.success(res, { deletedTagId: id, name: tag.name }, `Tag "${tag.name}" removed from vault system`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TagController;
