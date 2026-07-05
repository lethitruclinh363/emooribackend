const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ReactionControllers');
const auth = require('../middleware/auth');

router.post('/toggle', auth.verifyToken, ctrl.toggleReaction);
router.get('/post/:postId', auth.verifyToken, ctrl.getReactionsByPost);

module.exports = router;
