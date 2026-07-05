const express = require('express');
const router = express.Router();

const moodCtrl = require('../controllers/CheckinControllers');
const auth = require('../middleware/auth');

router.post('/', auth.verifyToken, moodCtrl.createCheckin);
router.get('/', auth.verifyToken, moodCtrl.getMyCheckins);
router.delete('/:id', auth.verifyToken, moodCtrl.deleteCheckin);

module.exports = router;