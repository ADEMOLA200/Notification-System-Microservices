const Joi = require('joi');

const createTemplateSchema = Joi.object({
  template_code: Joi.string().required(),
  content: Joi.string().required(),
  language: Joi.string().default('en'),
  variables_schema: Joi.array().items(Joi.string()).optional()
});

const updateTemplateSchema = Joi.object({
  content: Joi.string().optional(),
  language: Joi.string().optional(),
  variables_schema: Joi.array().items(Joi.string()).optional()
}).min(1);

const renderTemplateSchema = Joi.object({
  variables: Joi.object().required()
});

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
  renderTemplateSchema
};
