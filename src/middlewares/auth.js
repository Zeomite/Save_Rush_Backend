const jwt = require('jsonwebtoken');
const User = require('../services/user-service/userModel');

const JWT_SECRET = process.env.JWT_SECRET;

const auth = async (req, res, next) => {
  try {
    // Extract token from the Authorization header (expects: Bearer <token>)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Please authenticate', error: error.message });
  }
};

const authorize = (requiredRole) => {
  return (req, res, next) => {
    // req.user is assumed to be set by the authenticate middleware
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = {auth, authorize};
