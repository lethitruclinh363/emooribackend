const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/SubscriptionControllers');
const auth = require('../middleware/auth');

router.get('/', auth.verifyToken, ctrl.getSubscription);
router.get('/all', auth.verifyToken, auth.isAdmin, ctrl.getAllSubscriptions);
router.post('/', auth.verifyToken, ctrl.createSubscription);
router.put('/cancel', auth.verifyToken, ctrl.cancelSubscription);

module.exports = router;
