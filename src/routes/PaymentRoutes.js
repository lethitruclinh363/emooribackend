const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/PaymentControllers');
const auth = require('../middleware/auth');

router.post('/', auth.verifyToken, ctrl.createPayment);
router.post('/vnpay/create', auth.verifyToken, ctrl.createVnpayCheckout);
router.get('/vnpay/return', ctrl.handleVnpayReturn);
router.get('/vnpay/ipn', ctrl.handleVnpayIpn);
router.get('/history', auth.verifyToken, ctrl.getPaymentHistory);
router.put('/status', auth.verifyToken, ctrl.updatePaymentStatus);

module.exports = router;
