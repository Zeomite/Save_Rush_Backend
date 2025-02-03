const express = require('express');
const router = express.Router();
const { signup, login, getProfile, verifyToken } = require('../controllers/authController');
const auth = require('../middlewares/auth');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Token verification route
router.get('/verify', verifyToken);

// Protected routes
router.get('/profile', auth, getProfile);

module.exports = router; 