const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbPool } = require('../database/connection');
const logger = require('../utils/logger');

class AuthController {
  async login(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { email, password } = req.validatedBody;

      const result = await client.query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          data: null,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          meta: {
            request_id: req.id
          }
        });
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          data: null,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          meta: {
            request_id: req.id
          }
        });
      }

      const token = jwt.sign(
        { user_id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
      );

      logger.info('User logged in successfully', { userId: user.id, requestId: req.id });

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email
          }
        },
        error: null,
        message: 'Login successful',
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

  async verify(req, res) {
    res.json({
      success: true,
      data: {
        user: req.user
      },
      error: null,
      message: 'Token is valid',
      meta: {
        request_id: req.id
      }
    });
  }
}

module.exports = new AuthController();
