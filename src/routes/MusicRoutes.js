const express = require('express');
const {
  getMusicTracks,
  getMusicTrackById,
  increaseMusicPlayCount,
} = require('../controllers/MusicTrackControllers');

const router = express.Router();

router.get('/tracks', getMusicTracks);
router.get('/tracks/:id', getMusicTrackById);
router.post('/tracks/:id/play', increaseMusicPlayCount);

module.exports = router;
