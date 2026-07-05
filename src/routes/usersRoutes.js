const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/usersControllers');
const auth = require('../middleware/auth');

// REGISTER
router.post('/register', auth.checkDuplicateEmail, ctrl.createUser);

// LOGIN 
router.post('/login', ctrl.handleLogin);

// LOGIN WITH GOOGLE
router.post('/google', ctrl.handleGoogleLogin);

// REFRESH / LOGOUT
router.post('/refresh', ctrl.handleRefresh);
router.post('/logout', ctrl.handleLogout);

// FORGOT PASSWORD (OTP)
router.post('/forgot-password/request', ctrl.requestPasswordOtp);
router.post('/forgot-password/verify', ctrl.verifyPasswordOtp);
router.post('/forgot-password/reset', ctrl.resetPasswordWithToken);
router.post('/auth/change-password', auth.verifyToken, ctrl.changePassword);

// GET ALL USERS
router.get('/users', auth.verifyToken, auth.isAdmin, ctrl.getAllUsers);
router.put('/users/:id/plan', auth.verifyToken, auth.isAdmin, ctrl.updateUserPlan);

module.exports = router;
