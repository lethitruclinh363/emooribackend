const jwt = require('jsonwebtoken');
const User = require('../model/Users');

exports.checkDuplicateEmail = async (req, res, next) => {
    try {
        const email = req.body?.email;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalized = String(email)//ép email về string để tránh lỗi khi người dùng nhập số hoặc các kiểu dữ liệu khác
        .trim()//xóa khoảng trắng
        .toLowerCase();//không phân biệt hoa thường

        req.body.email = normalized;

        const user = await User
        .findOne({ email: normalized })
        .lean();
        
        if (user) {
            return res.status(400).json({ message: 'Failed! Email is already in use!' });
        }

        // Allows to proceed to the next API
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Internal server error' });
    }
};



exports.verifyToken = (req, res, next) => {
    try {
        // Get header Authorization
        const authorizationHeaader = req.headers.authorization;
        if (!authorizationHeaader) return res.status(401).json({ error: 'Access denied' });
        const token = req.headers.authorization.split(' ')[1]; // Bearer <token>

        // Verify that the token is valid and still valid
        const payload = jwt.verify(token, process.env.JWT_TOKEN_SECRET);

        // Save user information to req so that the route behind can use it
        req.user = { userId: payload.userId, role: payload.role };

        // Allows to proceed to the next API
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

exports.isAdmin = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const roleFromToken = req.user?.role;

        if (roleFromToken === 'admin') {
            return next();
        }

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.role === 'admin') {
            return next();
        }

        return res.status(403).json({ message: 'Require Admin Role!' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};


