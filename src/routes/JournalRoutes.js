const express = require('express');
const router = express.Router();

const journalCtrl = require('../controllers/JournalControllers');
const auth = require('../middleware/auth');

// nhật ký/bài viết
// CREATE
router.post('/', auth.verifyToken, journalCtrl.createJournal);

// GET MY
router.get('/my', auth.verifyToken, journalCtrl.getMyJournals);//chính mình

// PUBLIC FEED
router.get('/public', journalCtrl.getPublicJournals);//các bài public của mọi người

// UPDATE
router.put('/:id', auth.verifyToken, journalCtrl.updateJournal);

// DELETE
router.delete('/:id', auth.verifyToken, journalCtrl.deleteJournal);

module.exports = router;