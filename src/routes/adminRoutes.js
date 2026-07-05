const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminAuth = require('../middleware/admin/adminAuth');
const DashboardController = require('../controllers/admin/DashboardController');
const UserController = require('../controllers/admin/UserController');
const ThemeController = require('../controllers/admin/ThemeController');
const MascotController = require('../controllers/admin/MascotController');
const AchievementController = require('../controllers/admin/AchievementController');
const CommunityController = require('../controllers/admin/CommunityController');
const HealingContentController = require('../controllers/admin/HealingContentController');
const MusicTrackController = require('../controllers/admin/MusicTrackController');
const SettingsController = require('../controllers/admin/SettingsController');
const AiController = require('../controllers/admin/AiController');

const musicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 },
});

// Apply admin auth to all routes
router.use(adminAuth);

// Dashboard
router.get('/dashboard/summary', DashboardController.getDashboardSummary);

// Users
router.get('/users', UserController.getUsers);
router.get('/users/:id', UserController.getUserDetails);
router.patch('/users/:id/lock', UserController.lockUser);
router.patch('/users/:id/unlock', UserController.unlockUser);
router.patch('/users/:id/grant-xp', UserController.grantXp);
router.patch('/users/:id/grant-premium', UserController.grantPremium);
router.patch('/users/:id/revoke-premium', UserController.revokePremium);

// Themes
router.get('/themes', ThemeController.getThemes);
router.post('/themes', ThemeController.createTheme);
router.put('/themes/:id', ThemeController.updateTheme);
router.delete('/themes/:id', ThemeController.deleteTheme);
router.patch('/themes/:id/toggle', ThemeController.toggleTheme);

// Mascots
router.get('/mascots', MascotController.getMascots);
router.post('/mascots', MascotController.createMascot);
router.put('/mascots/:id', MascotController.updateMascot);
router.delete('/mascots/:id', MascotController.deleteMascot);
router.patch('/mascots/:id/toggle', MascotController.toggleMascot);

// Achievements
router.get('/achievements', AchievementController.getAchievements);
router.post('/achievements', AchievementController.createAchievement);
router.put('/achievements/:id', AchievementController.updateAchievement);
router.delete('/achievements/:id', AchievementController.deleteAchievement);
router.patch('/achievements/:id/toggle', AchievementController.toggleAchievement);

// Community
router.get('/community/posts', CommunityController.getPosts);
router.patch('/community/posts/:id/approve', CommunityController.approvePost);
router.patch('/community/posts/:id/hide', CommunityController.hidePost);
router.delete('/community/posts/:id', CommunityController.deletePost);
router.patch('/community/users/:id/ban', CommunityController.banUser);

// Healing Content
router.get('/healing-content', HealingContentController.getHealingContent);
router.post('/healing-content', HealingContentController.createHealingContent);
router.put('/healing-content/:id', HealingContentController.updateHealingContent);
router.delete('/healing-content/:id', HealingContentController.deleteHealingContent);
router.patch('/healing-content/:id/toggle', HealingContentController.toggleHealingContent);

// Healing Music
router.get('/music/tracks', MusicTrackController.getMusicTracks);
router.post(
  '/music/tracks',
  musicUpload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  MusicTrackController.createMusicTrack
);
router.put(
  '/music/tracks/:id',
  musicUpload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  MusicTrackController.updateMusicTrack
);
router.delete('/music/tracks/:id', MusicTrackController.deleteMusicTrack);
router.patch('/music/tracks/:id/toggle-active', MusicTrackController.toggleActive);
router.patch('/music/tracks/:id/toggle-premium', MusicTrackController.togglePremium);

// Settings
router.get('/settings', SettingsController.getSettings);
router.put('/settings', SettingsController.updateSettings);

// Premium Packages
router.get('/premium/packages', SettingsController.getPremiumPackages);
router.post('/premium/packages', SettingsController.createPremiumPackage);
router.put('/premium/packages/:id', SettingsController.updatePremiumPackage);
router.delete('/premium/packages/:id', SettingsController.deletePremiumPackage);
router.patch('/premium/packages/:id/toggle', SettingsController.togglePremiumPackage);

// AI Management
router.get('/ai/usage', AiController.getUsage);
router.get('/ai/chat-logs', AiController.getChatLogs);
router.get('/ai/image-generations', AiController.getImageGenerations);
router.get('/ai/styles', AiController.getStyles);
router.post('/ai/styles', AiController.createStyle);
router.put('/ai/styles/:id', AiController.updateStyle);
router.delete('/ai/styles/:id', AiController.deleteStyle);
router.patch('/ai/styles/:id/toggle', AiController.toggleStyle);

module.exports = router;
