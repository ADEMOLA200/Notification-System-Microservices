const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const { loginSchema } = require('../validators/userValidators');

router.post('/login', validate(loginSchema), authController.login);
router.post('/verify', authenticate, authController.verify);

module.exports = router;
