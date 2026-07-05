const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/PostControllers');
const auth = require('../middleware/auth');

router.post('/', auth.verifyToken, ctrl.createPost);
router.get('/', auth.verifyToken, ctrl.getMyPost);
router.get('/all', auth.verifyToken, ctrl.getAllPosts);
router.delete('/:id', auth.verifyToken, ctrl.deletePost);

module.exports = router;
