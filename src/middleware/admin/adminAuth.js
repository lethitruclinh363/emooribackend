const jwt = require('jsonwebtoken');
const User = require('../../model/Users');

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_TOKEN_SECRET;

    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const decoded = jwt.verify(token, secret);
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(decoded.userId).lean();
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = {
      userId: user._id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = adminAuth;
