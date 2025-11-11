const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const {
  createUserSchema,
  updateUserSchema,
  updatePreferencesSchema
} = require('../validators/userValidators');

router.post('/', validate(createUserSchema), userController.createUser);
router.get('/:id', authenticate, userController.getUser);
router.put('/:id', authenticate, validate(updateUserSchema), userController.updateUser);
router.patch('/:id/preferences', authenticate, validate(updatePreferencesSchema), userController.updatePreferences);

module.exports = router;
