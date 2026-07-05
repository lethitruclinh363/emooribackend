const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/CommentControllers.js');
const auth = require('../middleware/auth');



// GET COMMENT 
router.get('/comment', auth.verifyToken, auth.isAdmin, ctrl.getAllComment);
router.get('/post/:postId', auth.verifyToken, ctrl.getCommentsByPost);
router.post('/comment',auth.verifyToken,ctrl.createComment);
router.delete('/:id', auth.verifyToken, ctrl.deleteComment);
router.put('/:id', auth.verifyToken, ctrl.updateComment);
module.exports = router;
