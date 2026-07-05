const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/PostControllers');
const ReactionControllers = require('../controllers/ReactionControllers');
const CommentControllers = require('../controllers/CommentControllers.js');
const auth = require('../middleware/auth');

router.post('/posts', auth.verifyToken, ctrl.createPost);
router.get('/posts', auth.verifyToken, ctrl.getMyPost);
router.get('/posts/all', auth.verifyToken, ctrl.getAllPosts);
router.delete('/posts/:id', auth.verifyToken, ctrl.deletePost);
router.post('/posts/:id/react', auth.verifyToken, (req, res) => {
  req.body = { ...(req.body || {}), postId: req.params.id };
  return ReactionControllers.toggleReaction(req, res);
});
router.post('/posts/:id/comment', auth.verifyToken, (req, res) => {
  req.body = { ...(req.body || {}), postId: req.params.id };
  return CommentControllers.createComment(req, res);
});

module.exports = router;
