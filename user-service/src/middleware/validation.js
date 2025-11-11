const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        data: null,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        meta: {
          request_id: req.id,
          errors
        }
      });
    }

    req.validatedBody = value;
    next();
  };
};

module.exports = validate;
