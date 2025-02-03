const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token with 10 minutes expiration
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30m' });
};

// Verify token validity
const verifyToken = async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                valid: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ 
                valid: false,
                message: 'Token invalid - User not found'
            });
        }

        // Calculate remaining time
        const currentTime = Math.floor(Date.now() / 1000);
        const timeRemaining = decoded.exp - currentTime;

        res.json({
            valid: true,
            message: 'Token is valid',
            expiresIn: timeRemaining,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                valid: false,
                message: 'Token has expired'
            });
        }
        res.status(401).json({
            valid: false,
            message: 'Invalid token',
            error: error.message
        });
    }
};

// User signup
const signup = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const user = new User({ username, email, password });
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

// User login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const user = req.user;
        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};

module.exports = {
    signup,
    login,
    getProfile,
    verifyToken
}; 