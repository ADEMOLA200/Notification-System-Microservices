const bcrypt = require('bcryptjs');
const { dbPool } = require('../database/connection');
const logger = require('../utils/logger');

class UserController {
  async createUser(req, res, next) {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const { email, password, push_token, preferences } = req.validatedBody;

      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          data: null,
          error: 'USER_EXISTS',
          message: 'User with this email already exists',
          meta: {
            request_id: req.id
          }
        });
      }

      const passwordHash = await bcrypt.hash(
        password,
        parseInt(process.env.BCRYPT_ROUNDS) || 10
      );

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, push_token, preferences)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, push_token, preferences, created_at, updated_at`,
        [email, passwordHash, push_token || null, preferences || {}]
      );

      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO user_preferences (user_id, email_notifications, push_notifications)
         VALUES ($1, $2, $3)`,
        [user.id, true, true]
      );

      await client.query('COMMIT');

      logger.info('User created successfully', { userId: user.id, requestId: req.id });

      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          push_token: user.push_token,
          preferences: user.preferences,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        error: null,
        message: 'User created successfully',
        meta: {
          request_id: req.id
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  async getUser(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { id } = req.params;

      const result = await client.query(
        `SELECT u.id, u.email, u.push_token, u.preferences, u.created_at, u.updated_at,
                up.email_notifications, up.push_notifications
         FROM users u
         LEFT JOIN user_preferences up ON u.id = up.user_id
         WHERE u.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'USER_NOT_FOUND',
          message: 'User not found',
          meta: {
            request_id: req.id
          }
        });
      }

      const user = result.rows[0];

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          push_token: user.push_token,
          preferences: user.preferences,
          notification_preferences: {
            email_notifications: user.email_notifications,
            push_notifications: user.push_notifications
          },
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        error: null,
        message: 'User retrieved successfully',
        meta: {
          request_id: req.id
        }
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }

  async updateUser(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { id } = req.params;
      const { email, push_token, preferences } = req.validatedBody;

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (push_token !== undefined) {
        updates.push(`push_token = $${paramCount++}`);
        values.push(push_token);
      }
      if (preferences !== undefined) {
        updates.push(`preferences = $${paramCount++}`);
        values.push(preferences);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'NO_UPDATES',
          message: 'No valid fields to update',
          meta: {
            request_id: req.id
          }
        });
      }

      values.push(id);

      const result = await client.query(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, email, push_token, preferences, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'USER_NOT_FOUND',
          message: 'User not found',
          meta: {
            request_id: req.id
          }
        });
      }

      const user = result.rows[0];

      logger.info('User updated successfully', { userId: user.id, requestId: req.id });

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          push_token: user.push_token,
          preferences: user.preferences,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        error: null,
        message: 'User updated successfully',
        meta: {
          request_id: req.id
        }
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }

  async updatePreferences(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { id } = req.params;
      const { email_notifications, push_notifications } = req.validatedBody;

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (email_notifications !== undefined) {
        updates.push(`email_notifications = $${paramCount++}`);
        values.push(email_notifications);
      }
      if (push_notifications !== undefined) {
        updates.push(`push_notifications = $${paramCount++}`);
        values.push(push_notifications);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'NO_UPDATES',
          message: 'No valid preferences to update',
          meta: {
            request_id: req.id
          }
        });
      }

      values.push(id);

      const result = await client.query(
        `UPDATE user_preferences
         SET ${updates.join(', ')}
         WHERE user_id = $${paramCount}
         RETURNING user_id, email_notifications, push_notifications, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'USER_NOT_FOUND',
          message: 'User preferences not found',
          meta: {
            request_id: req.id
          }
        });
      }

      const prefs = result.rows[0];

      logger.info('User preferences updated', { userId: id, requestId: req.id });

      res.json({
        success: true,
        data: {
          user_id: prefs.user_id,
          email_notifications: prefs.email_notifications,
          push_notifications: prefs.push_notifications,
          created_at: prefs.created_at,
          updated_at: prefs.updated_at
        },
        error: null,
        message: 'Preferences updated successfully',
        meta: {
          request_id: req.id
        }
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }
}

module.exports = new UserController();
