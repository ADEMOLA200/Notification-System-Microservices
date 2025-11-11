const { dbPool } = require('../database/connection');
const redisClient = require('../utils/redis');
const templateRenderer = require('../utils/templateRenderer');
const logger = require('../utils/logger');

class TemplateController {
  async createTemplate(req, res, next) {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const { template_code, content, language, variables_schema } = req.validatedBody;

      const existingTemplate = await client.query(
        'SELECT id FROM templates WHERE template_code = $1',
        [template_code]
      );

      if (existingTemplate.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          data: null,
          error: 'TEMPLATE_EXISTS',
          message: 'Template with this code already exists',
          meta: {
            request_id: req.id
          }
        });
      }

      const extractedVariables = templateRenderer.extractVariables(content);
      const variablesSchemaToUse = variables_schema || extractedVariables;

      const result = await client.query(
        `INSERT INTO templates (template_code, content, language, version, variables_schema)
         VALUES ($1, $2, $3, 1, $4)
         RETURNING id, template_code, content, language, version, variables_schema, created_at, updated_at`,
        [template_code, content, language || 'en', JSON.stringify(variablesSchemaToUse)]
      );

      const template = result.rows[0];

      await client.query(
        `INSERT INTO template_versions (template_id, content, version)
         VALUES ($1, $2, $3)`,
        [template.id, content, 1]
      );

      await client.query('COMMIT');

      await redisClient.del(`template:${template_code}`);

      logger.info('Template created successfully', { templateId: template.id, requestId: req.id });

      res.status(201).json({
        success: true,
        data: {
          id: template.id,
          template_code: template.template_code,
          content: template.content,
          language: template.language,
          version: template.version,
          variables_schema: template.variables_schema,
          created_at: template.created_at,
          updated_at: template.updated_at
        },
        error: null,
        message: 'Template created successfully',
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

  async listTemplates(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { language, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let query = 'SELECT id, template_code, language, version, variables_schema, created_at, updated_at FROM templates';
      const values = [];

      if (language) {
        query += ' WHERE language = $1';
        values.push(language);
      }

      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(limit, offset);

      const result = await client.query(query, values);

      const countQuery = language 
        ? 'SELECT COUNT(*) FROM templates WHERE language = $1'
        : 'SELECT COUNT(*) FROM templates';
      const countValues = language ? [language] : [];
      const countResult = await client.query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: {
          templates: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        },
        error: null,
        message: 'Templates retrieved successfully',
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

  async getTemplate(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { code } = req.params;

      const cached = await redisClient.get(`template:${code}`);
      if (cached) {
        logger.info('Template retrieved from cache', { templateCode: code, requestId: req.id });
        return res.json({
          success: true,
          data: JSON.parse(cached),
          error: null,
          message: 'Template retrieved successfully',
          meta: {
            request_id: req.id,
            cached: true
          }
        });
      }

      const result = await client.query(
        `SELECT id, template_code, content, language, version, variables_schema, created_at, updated_at
         FROM templates
         WHERE template_code = $1`,
        [code]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found',
          meta: {
            request_id: req.id
          }
        });
      }

      const template = result.rows[0];

      await redisClient.setEx(
        `template:${code}`,
        3600,
        JSON.stringify(template)
      );

      res.json({
        success: true,
        data: template,
        error: null,
        message: 'Template retrieved successfully',
        meta: {
          request_id: req.id,
          cached: false
        }
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }

  async updateTemplate(req, res, next) {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const { code } = req.params;
      const { content, language, variables_schema } = req.validatedBody;

      const existingTemplate = await client.query(
        'SELECT id, version FROM templates WHERE template_code = $1',
        [code]
      );

      if (existingTemplate.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          data: null,
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found',
          meta: {
            request_id: req.id
          }
        });
      }

      const { id: templateId, version: currentVersion } = existingTemplate.rows[0];
      const newVersion = currentVersion + 1;

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        values.push(content);
        updates.push(`version = $${paramCount++}`);
        values.push(newVersion);

        const extractedVariables = templateRenderer.extractVariables(content);
        const variablesSchemaToUse = variables_schema || extractedVariables;
        updates.push(`variables_schema = $${paramCount++}`);
        values.push(JSON.stringify(variablesSchemaToUse));
      }

      if (language !== undefined) {
        updates.push(`language = $${paramCount++}`);
        values.push(language);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
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

      values.push(code);

      const result = await client.query(
        `UPDATE templates
         SET ${updates.join(', ')}
         WHERE template_code = $${paramCount}
         RETURNING id, template_code, content, language, version, variables_schema, created_at, updated_at`,
        values
      );

      const template = result.rows[0];

      if (content !== undefined) {
        await client.query(
          `INSERT INTO template_versions (template_id, content, version)
           VALUES ($1, $2, $3)`,
          [templateId, content, newVersion]
        );
      }

      await client.query('COMMIT');

      await redisClient.del(`template:${code}`);

      logger.info('Template updated successfully', { templateId: template.id, requestId: req.id });

      res.json({
        success: true,
        data: {
          id: template.id,
          template_code: template.template_code,
          content: template.content,
          language: template.language,
          version: template.version,
          variables_schema: template.variables_schema,
          created_at: template.created_at,
          updated_at: template.updated_at
        },
        error: null,
        message: 'Template updated successfully',
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

  async renderTemplate(req, res, next) {
    const client = await dbPool.connect();
    try {
      const { code } = req.params;
      const { variables } = req.validatedBody;

      const result = await client.query(
        'SELECT content FROM templates WHERE template_code = $1',
        [code]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found',
          meta: {
            request_id: req.id
          }
        });
      }

      const { content } = result.rows[0];

      const validation = templateRenderer.validateVariables(content, variables);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'MISSING_VARIABLES',
          message: 'Required template variables are missing',
          meta: {
            request_id: req.id,
            missing_variables: validation.missing_variables
          }
        });
      }

      const renderedContent = templateRenderer.render(content, variables);

      logger.info('Template rendered successfully', { templateCode: code, requestId: req.id });

      res.json({
        success: true,
        data: {
          template_code: code,
          rendered_content: renderedContent,
          variables_used: Object.keys(variables)
        },
        error: null,
        message: 'Template rendered successfully',
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

module.exports = new TemplateController();
