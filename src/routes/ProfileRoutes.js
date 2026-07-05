const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ProfileControllers');
const auth = require('../middleware/auth');

router.get('/', auth.verifyToken, ctrl.getProfile);
router.put('/', auth.verifyToken, ctrl.updateProfile);

module.exports = router;
