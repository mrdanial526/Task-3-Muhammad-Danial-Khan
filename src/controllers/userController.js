const db = require('../database/db');
const ApiResponse = require('../utils/apiResponse');
const { hashPassword } = require('../utils/crypto');

class UserController {
  /**
   * List all users with pagination, filtering & search
   * GET /api/v1/users
   */
  static listUsers(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const { role, status, search, sortBy = 'created_at', order = 'DESC' } = req.query;

      const conditions = [];
      const params = [];

      if (role) {
        conditions.push('u.role = ?');
        params.push(role);
      }

      if (status) {
        conditions.push('u.status = ?');
        params.push(status);
      }

      if (search) {
        conditions.push('(u.username LIKE ? OR u.email LIKE ? OR p.full_name LIKE ?)');
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Validate sort column against whitelist to prevent SQL injection in ORDER BY
      const allowedSortColumns = {
        'id': 'u.id',
        'username': 'u.username',
        'email': 'u.email',
        'role': 'u.role',
        'status': 'u.status',
        'created_at': 'u.created_at',
        'clearance_level': 'p.clearance_level'
      };
      const sortCol = allowedSortColumns[sortBy] || 'u.created_at';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Count query
      const countSql = `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        ${whereClause}
      `;
      const countRow = db.queryOne(countSql, params);
      const total = countRow ? countRow.total : 0;

      // Data query with 1:1 join to user_profiles and aggregation for folders/items
      const dataSql = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.role,
          u.status,
          u.created_at,
          u.updated_at,
          p.id AS profile_id,
          p.full_name,
          p.avatar_url,
          p.bio,
          p.clearance_level,
          p.phone_number,
          p.emergency_code,
          (SELECT COUNT(*) FROM vault_folders f WHERE f.user_id = u.id) AS folders_count,
          (SELECT COUNT(*) FROM vault_items i WHERE i.user_id = u.id) AS items_count
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        ${whereClause}
        ORDER BY ${sortCol} ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      const rows = db.query(dataSql, [...params, limit, offset]);

      // Format response with nested 1:1 profile object
      const formatted = rows.map((r) => ({
        id: r.id,
        username: r.username,
        email: r.email,
        role: r.role,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        foldersCount: r.folders_count,
        itemsCount: r.items_count,
        profile: r.profile_id ? {
          id: r.profile_id,
          fullName: r.full_name,
          avatarUrl: r.avatar_url,
          bio: r.bio,
          clearanceLevel: r.clearance_level,
          phoneNumber: r.phone_number,
          emergencyCode: r.emergency_code
        } : null
      }));

      return ApiResponse.paginated(res, formatted, { page, limit, total }, 'Users retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single user with 1:1 profile and statistics
   * GET /api/v1/users/:id
   */
  static getUserById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'User ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const sql = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.role,
          u.status,
          u.created_at,
          u.updated_at,
          p.id AS profile_id,
          p.full_name,
          p.avatar_url,
          p.bio,
          p.clearance_level,
          p.phone_number,
          p.emergency_code,
          (SELECT COUNT(*) FROM vault_folders f WHERE f.user_id = u.id) AS folders_count,
          (SELECT COUNT(*) FROM vault_items i WHERE i.user_id = u.id) AS items_count
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = ?
      `;

      const row = db.queryOne(sql, [id]);
      if (!row) {
        return ApiResponse.error(res, `User with ID ${id} not found`, 404, 'USER_NOT_FOUND');
      }

      const user = {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        foldersCount: row.folders_count,
        itemsCount: row.items_count,
        profile: row.profile_id ? {
          id: row.profile_id,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
          bio: row.bio,
          clearanceLevel: row.clearance_level,
          phoneNumber: row.phone_number,
          emergencyCode: row.emergency_code
        } : null
      };

      return ApiResponse.success(res, user, 'User retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create new user and 1:1 profile in a single ACID Transaction
   * POST /api/v1/users
   */
  static createUser(req, res, next) {
    try {
      const { username, email, password, role, status, profile } = req.body;
      const hashedPassword = hashPassword(password);

      // Execute in ACID transaction
      const result = db.transaction(() => {
        // 1. Insert User
        const insertUserStmt = db.prepare(`
          INSERT INTO users (username, email, password_hash, role, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        const userRes = insertUserStmt.run(username, email, hashedPassword, role, status);
        const userId = userRes.lastInsertRowid;

        // 2. Insert 1:1 Profile
        const insertProfileStmt = db.prepare(`
          INSERT INTO user_profiles (user_id, full_name, avatar_url, bio, clearance_level, phone_number, emergency_code, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        const profileRes = insertProfileStmt.run(
          userId,
          profile.fullName,
          profile.avatarUrl || null,
          profile.bio || null,
          profile.clearanceLevel || 1,
          profile.phoneNumber || null,
          profile.emergencyCode || null
        );

        // 3. Log to audit trail
        const insertAuditStmt = db.prepare(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, status, details)
          VALUES (?, 'USER_CREATED', 'USER', ?, ?, 'SUCCESS', ?)
        `);
        insertAuditStmt.run(userId, userId, req.ip || '127.0.0.1', `Created user account @${username}`);

        return {
          id: userId,
          username,
          email,
          role,
          status,
          profile: {
            id: profileRes.lastInsertRowid,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl || null,
            bio: profile.bio || null,
            clearanceLevel: profile.clearanceLevel || 1,
            phoneNumber: profile.phoneNumber || null,
            emergencyCode: profile.emergencyCode || null
          }
        };
      });

      return ApiResponse.created(res, result, 'User and security profile successfully created in vault');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update user and optional profile
   * PUT/PATCH /api/v1/users/:id
   */
  static updateUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'User ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
      if (!existing) {
        return ApiResponse.error(res, `User with ID ${id} not found`, 404, 'USER_NOT_FOUND');
      }

      const { username, email, role, status, profile } = req.body;

      db.transaction(() => {
        // Update user fields
        const userUpdates = [];
        const userParams = [];

        if (username !== undefined) {
          userUpdates.push('username = ?');
          userParams.push(username);
        }
        if (email !== undefined) {
          userUpdates.push('email = ?');
          userParams.push(email);
        }
        if (role !== undefined) {
          userUpdates.push('role = ?');
          userParams.push(role);
        }
        if (status !== undefined) {
          userUpdates.push('status = ?');
          userParams.push(status);
        }

        if (userUpdates.length > 0) {
          userUpdates.push("updated_at = datetime('now')");
          const updateSql = `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`;
          userParams.push(id);
          db.execute(updateSql, userParams);
        }

        // Update profile fields if provided
        if (profile) {
          const profileUpdates = [];
          const profileParams = [];

          if (profile.fullName !== undefined) {
            profileUpdates.push('full_name = ?');
            profileParams.push(profile.fullName);
          }
          if (profile.avatarUrl !== undefined) {
            profileUpdates.push('avatar_url = ?');
            profileParams.push(profile.avatarUrl);
          }
          if (profile.bio !== undefined) {
            profileUpdates.push('bio = ?');
            profileParams.push(profile.bio);
          }
          if (profile.clearanceLevel !== undefined) {
            profileUpdates.push('clearance_level = ?');
            profileParams.push(profile.clearanceLevel);
          }
          if (profile.phoneNumber !== undefined) {
            profileUpdates.push('phone_number = ?');
            profileParams.push(profile.phoneNumber);
          }
          if (profile.emergencyCode !== undefined) {
            profileUpdates.push('emergency_code = ?');
            profileParams.push(profile.emergencyCode);
          }

          if (profileUpdates.length > 0) {
            profileUpdates.push("updated_at = datetime('now')");
            const updateProfileSql = `UPDATE user_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`;
            profileParams.push(id);
            db.execute(updateProfileSql, profileParams);
          }
        }
      });

      return UserController.getUserById(req, res, next);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete user and trigger CASCADE deletion of profiles, folders, items, junctions
   * DELETE /api/v1/users/:id
   */
  static deleteUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'User ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT username FROM users WHERE id = ?', [id]);
      if (!existing) {
        return ApiResponse.error(res, `User with ID ${id} not found`, 404, 'USER_NOT_FOUND');
      }

      // Execute parameterized DELETE. Foreign Key ON DELETE CASCADE automatically removes:
      // - user_profiles
      // - vault_folders
      // - vault_items
      // - vault_item_tags (via item cascade)
      const resExec = db.execute('DELETE FROM users WHERE id = ?', [id]);

      return ApiResponse.success(
        res,
        {
          deletedUserId: id,
          username: existing.username,
          cascaded: true,
          rowsAffected: resExec.changes
        },
        `User @${existing.username} and all associated relational records deleted via ON DELETE CASCADE`
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get 1:1 Profile for a specific user
   * GET /api/v1/users/:id/profile
   */
  static getUserProfile(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return ApiResponse.error(res, 'User ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const profile = db.queryOne('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
      if (!profile) {
        return ApiResponse.error(res, `Profile for user ID ${userId} not found`, 404, 'PROFILE_NOT_FOUND');
      }

      return ApiResponse.success(res, profile, 'Profile retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update 1:1 Profile
   * PUT/PATCH /api/v1/users/:id/profile
   */
  static updateUserProfile(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return ApiResponse.error(res, 'User ID must be an integer', 400, 'INVALID_PARAMETER');
      }

      const existing = db.queryOne('SELECT id FROM user_profiles WHERE user_id = ?', [userId]);
      if (!existing) {
        return ApiResponse.error(res, `Profile for user ID ${userId} not found`, 404, 'PROFILE_NOT_FOUND');
      }

      const { fullName, avatarUrl, bio, clearanceLevel, phoneNumber, emergencyCode } = req.body;
      const updates = [];
      const params = [];

      if (fullName !== undefined) { updates.push('full_name = ?'); params.push(fullName); }
      if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }
      if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
      if (clearanceLevel !== undefined) { updates.push('clearance_level = ?'); params.push(clearanceLevel); }
      if (phoneNumber !== undefined) { updates.push('phone_number = ?'); params.push(phoneNumber); }
      if (emergencyCode !== undefined) { updates.push('emergency_code = ?'); params.push(emergencyCode); }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        const sql = `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = ?`;
        params.push(userId);
        db.execute(sql, params);
      }

      const updated = db.queryOne('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
      return ApiResponse.success(res, updated, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
