const jwt = require('jsonwebtoken');
const User = require('../services/user-service/userModel');

const JWT_SECRET = process.env.JWT_SECRET;

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // List of paths that require verification
        const requiresVerification = [
            '/profile',
            '/cart',
            '/orders',
            '/payment'
            // Add other paths that need verification
        ];

        // Check if current path requires verification
        const needsVerification = requiresVerification.some(path => req.path.startsWith(path));
        
        // Only check verification status for routes that require it
        if (needsVerification && !user.isEmailVerified && !user.isPhoneVerified) {
            return res.status(403).json({ 
                message: 'Account not verified. Please verify your email or phone number.',
                requiresVerification: true,
                verification: {
                    isEmailVerified: user.isEmailVerified,
                    isPhoneVerified: user.isPhoneVerified,
                    requiresEmailVerification: !user.isEmailVerified,
                    requiresPhoneVerification: user.phoneNumber && !user.isPhoneVerified
                }
            });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};

module.exports = auth;
