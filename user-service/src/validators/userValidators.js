const Joi = require('joi');

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  push_token: Joi.string().optional(),
  preferences: Joi.object().optional()
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  push_token: Joi.string().optional(),
  preferences: Joi.object().optional()
}).min(1);

const updatePreferencesSchema = Joi.object({
  email_notifications: Joi.boolean().optional(),
  push_notifications: Joi.boolean().optional()
}).min(1);

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updatePreferencesSchema,
  loginSchema
};
