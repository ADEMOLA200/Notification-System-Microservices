const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const validate = require('../middleware/validation');
const {
  createTemplateSchema,
  updateTemplateSchema,
  renderTemplateSchema
} = require('../validators/templateValidators');

router.post('/', validate(createTemplateSchema), templateController.createTemplate);
router.get('/', templateController.listTemplates);
router.get('/:code', templateController.getTemplate);
router.put('/:code', validate(updateTemplateSchema), templateController.updateTemplate);
router.post('/:code/render', validate(renderTemplateSchema), templateController.renderTemplate);

module.exports = router;
