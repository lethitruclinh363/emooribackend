const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/RecommendationControllers');
const auth = require('../middleware/auth');

router.get('/mood/:mood', auth.verifyToken, ctrl.getRecommendationsByMood);
router.get('/', auth.verifyToken, ctrl.getAllRecommendations);
router.post('/', auth.verifyToken, ctrl.createRecommendation);

module.exports = router;
