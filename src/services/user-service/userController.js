<<<<<<< HEAD
const jwt = require('jsonwebtoken');
const User = require('./userModel.js');
const crypto = require('crypto');
const { generateOTP, sendSMSOTP, sendEmailOTP, generateVerificationToken, sendEmailVerification, verifyPhoneOTP } = require('../../utils/notification');

const JWT_SECRET = process.env.JWT_SECRET;

// Generate JWT token with 30 minutes expiration
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

// Send Email Verification Code
const sendEmailVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        const otp = generateOTP();
        
        // Set verification code with 10 minutes expiration
        user.emailVerificationCode = {
            code: otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        };
        await user.save();

        await sendEmailOTP(email, otp);
        
        res.json({ 
            message: 'Verification code sent to email',
            expiresIn: '10 minutes'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error sending email verification', error: error.message });
    }
};

// Send Phone Verification Code
const sendPhoneVerification = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Find user by phone number
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isPhoneVerified) {
            return res.status(400).json({ message: 'Phone number is already verified' });
        }

        // Send verification via Twilio Verify
        const verificationResult = await sendSMSOTP(phoneNumber);
        
        if (!verificationResult.valid) {
            return res.status(400).json({ 
                message: 'Failed to send verification code',
                error: verificationResult.message 
            });
        }
        
        res.json({ 
            message: 'Verification code sent to phone number',
            status: verificationResult.status,
            expiresIn: '10 minutes'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error sending phone verification', error: error.message });
    }
};

// Verify Email Code
const verifyEmailCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        if (!user.emailVerificationCode || !user.emailVerificationCode.code) {
            return res.status(400).json({ message: 'No verification code found. Please request a new one.' });
        }

        if (new Date() > user.emailVerificationCode.expiresAt) {
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (code !== user.emailVerificationCode.code) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        user.isEmailVerified = true;
        user.emailVerificationCode = undefined;
        await user.save();

        res.json({ 
            message: 'Email verified successfully',
            isEmailVerified: true
        });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying email', error: error.message });
    }
};

// Verify Phone Code
const verifyPhoneCode = async (req, res) => {
    try {
        const { phoneNumber, code } = req.body;
        console.log('Received verification request:', { phoneNumber, code });

        if (!phoneNumber || !code) {
            return res.status(400).json({ message: 'Phone number and verification code are required' });
        }

        // Find user by phone number
        const user = await User.findOne({ phoneNumber });
        console.log('Found user:', user ? 'Yes' : 'No');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isPhoneVerified) {
            return res.status(400).json({ message: 'Phone number is already verified' });
        }

        try {
            // Verify code using Twilio Verify
            console.log('Attempting to verify code with Twilio...');
            const verificationResult = await verifyPhoneOTP(phoneNumber, code);
            console.log('Verification result:', verificationResult);

            if (!verificationResult.valid) {
                return res.status(400).json({ 
                    message: 'Invalid verification code',
                    status: verificationResult.status
                });
            }

            user.isPhoneVerified = true;
            await user.save();

            res.json({ 
                message: 'Phone number verified successfully',
                isPhoneVerified: true,
                status: verificationResult.status
            });
        } catch (verifyError) {
            console.error('Twilio verification error:', verifyError);
            return res.status(400).json({ 
                message: 'Error verifying code',
                error: verifyError.message
            });
        }
    } catch (error) {
        console.error('Phone verification error:', error);
        res.status(500).json({ 
            message: 'Error verifying phone number', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// User signup
const signup = async (req, res) => {
    try {
        const { username, email, password, phoneNumber } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email }, 
                { username },
                { phoneNumber: phoneNumber || undefined }
            ] 
        });
        
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user
        const user = new User({ username, email, password, phoneNumber });
        
        // Generate verification codes
        const emailOTP = generateOTP();
        const phoneOTP = phoneNumber ? generateOTP() : null;
        
        // Set verification code with 10 minutes expiration
        user.emailVerificationCode = {
            code: emailOTP,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        };
        
        if (phoneNumber && phoneOTP) {
            user.phoneVerificationCode = {
                code: phoneOTP,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            };
        }
        
        await user.save();

        // Send verification codes
        try {
            await sendEmailOTP(email, emailOTP);
            if (phoneNumber && phoneOTP) {
                await sendSMSOTP(phoneNumber, phoneOTP);
            }
        } catch (error) {
            console.error('Error sending verification:', error);
            // We continue even if sending fails, as the user can request new codes
        }

        // Generate temporary token
        const token = generateToken(user._id);

        res.status(201).json({
            message: 'User created successfully. Please check your email for verification code.',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified
            },
            requiresVerification: true
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

        // Check verification status
        if (!user.isEmailVerified && !user.isPhoneVerified) {
            // Generate new verification codes and send them
            const emailOTP = generateOTP();
            let phoneOTP = null;

            // Set email verification code
            user.emailVerificationCode = {
                code: emailOTP,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            };

            // Set phone verification code if phone number exists
            if (user.phoneNumber) {
                phoneOTP = generateOTP();
                user.phoneVerificationCode = {
                    code: phoneOTP,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
                };
            }

            await user.save();

            // Send verification codes
            try {
                await sendEmailOTP(email, emailOTP);
                if (user.phoneNumber && phoneOTP) {
                    await sendSMSOTP(user.phoneNumber, phoneOTP);
                }
            } catch (error) {
                console.error('Error sending verification codes:', error);
            }

            return res.status(403).json({
                message: user.phoneNumber 
                    ? 'Your email and phone number are not verified. Please verify at least one to access your account. Verification codes have been sent.'
                    : 'Your email is not verified. Please verify it to access your account. A verification code has been sent.',
                requiresVerification: true,
                verification: {
                    isEmailVerified: false,
                    isPhoneVerified: false,
                    emailPending: true,
                    phonePending: !!user.phoneNumber,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    verificationSent: true,
                    expiresIn: '10 minutes'
                }
            });
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
                phoneNumber: user.phoneNumber,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified
            },
            verification: {
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
                requiresEmailVerification: !user.isEmailVerified,
                requiresPhoneVerification: user.phoneNumber && !user.isPhoneVerified
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

// Check verification status
const checkVerificationStatus = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            email: user.email,
            phoneNumber: user.phoneNumber,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            requiresEmailVerification: !user.isEmailVerified,
            requiresPhoneVerification: user.phoneNumber && !user.isPhoneVerified
        });
    } catch (error) {
        res.status(500).json({ message: 'Error checking verification status', error: error.message });
    }
};

// Resend verification code
const resendVerification = async (req, res) => {
    try {
        const { email, verificationType } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        if (verificationType === 'email') {
            user.emailVerificationCode = { code: otp, expiresAt };
            await user.save();
            await sendEmailOTP(email, otp);
        } else if (verificationType === 'phone' && user.phoneNumber) {
            user.phoneVerificationCode = { code: otp, expiresAt };
            await user.save();
            await sendSMSOTP(user.phoneNumber, otp);
        } else {
            return res.status(400).json({ message: 'Invalid verification type or phone number not found' });
        }

        res.json({ 
            message: `Verification code sent to your ${verificationType}`,
            sentTo: verificationType === 'email' ? email : user.phoneNumber
        });
    } catch (error) {
        res.status(500).json({ message: 'Error resending verification code', error: error.message });
    }
};

// Request Password Reset
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Save hashed token to user
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Format the reset email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        const emailSubject = 'Save Rush - Password Reset Request';
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2c3e50; text-align: center;">Password Reset Request</h1>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <p style="font-size: 16px;">Hello ${user.username},</p>
                    <p style="font-size: 16px;">You have requested to reset your password. Please click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 10 minutes.</p>
                    <p style="color: #666; font-size: 14px;">If you did not request this password reset, please ignore this email.</p>
                </div>
                <p style="color: #666; font-size: 12px; text-align: center;">
                    If the button doesn't work, you can copy and paste this link into your browser:<br>
                    <span style="color: #2c3e50;">${resetLink}</span>
                </p>
            </div>
        `;

        // Send reset email with proper formatting
        await sendEmailOTP(email, null, emailSubject, emailHtml);

        res.json({ 
            message: 'Password reset instructions sent to email',
            expiresIn: '10 minutes'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error requesting password reset', error: error.message });
    }
};

// Reset Password
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required' });
        }

        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Update password and clear reset token
        user.password = newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
};

module.exports = {
    signup,
    login,
    getProfile,
    verifyToken,
    verifyEmailCode,
    verifyPhoneCode,
    sendEmailVerificationCode,
    sendPhoneVerification,
    resendVerification,
    checkVerificationStatus,
    requestPasswordReset,
    resetPassword
}; 


=======
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("./userModel");
const {
  generateOTP,
  sendSMSOTP,
  sendEmailOTP,
  verifyPhoneOTP,
} = require("../../utils/notification");
const { cacheDocument, deleteCachedDocument } = require("../../utils/redisClient");

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to generate JWT token (default: 30 minutes expiry)
const generateToken = (userId,role, expiresIn = "30m") => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn });
};

// Send Email Verification Code
exports.sendEmailVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified)
      return res.status(400).json({ message: "Email is already verified" });

    const otp = generateOTP();
    user.emailVerificationCode = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Expires in 10 minutes
    };
    await user.save();

    // Send OTP asynchronously (errors logged but not blocking)
    sendEmailOTP(email, otp).catch((err) =>
      console.error("Error sending email OTP:", err)
    );

    res.json({
      message: "Verification code sent to email",
      expiresIn: "10 minutes",
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error sending email verification",
        error: error.message,
      });
  }
};


// Verify Email Code
exports.verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res
        .status(400)
        .json({ message: "Email and verification code are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified)
      return res.status(400).json({ message: "Email is already verified" });

    if (!user.emailVerificationCode?.code) {
      return res
        .status(400)
        .json({
          message: "No verification code found. Please request a new one.",
        });
    }
    if (new Date() > user.emailVerificationCode.expiresAt) {
      return res
        .status(400)
        .json({
          message: "Verification code has expired. Please request a new one.",
        });
    }
    if (code !== user.emailVerificationCode.code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    await user.save();

    res.json({ message: "Email verified successfully", isEmailVerified: true });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error verifying email", error: error.message });
  }
};



exports.login = async (req, res) => {
  try {
    const { uid, username, phoneNumber, role, location } = req.body;
    if (!uid) {
      return res.status(400).json({ message: 'Firebase UID is required' });
    }

    // Check if a user already exists with the given email, username, or phone number
    const existingUser = await User.findOne({ phoneNumber: phoneNumber });
    if (existingUser) {
      const token = generateToken(String(existingUser._id), role)
      return res.status(400).json(...existingUser,token,{ message: "User already exists" });
    }

    const newUser = new User({
      _id: uid,
      username,
      role,
      phoneNumber
    })
    await newUser.save();

    const token = generateToken(newUser._id, newUser.role);
    res.status(201).json({
      message:
        "User created successfully.",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        isEmailVerified: newUser.isEmailVerified
    }});
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};

// Get User Profile (Protected)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user._id; 

    const cacheKey = `user:${userId}`;
    const cachedProfile = await redisClient.get(cacheKey);
    if (cachedProfile) {
      return res
        .status(200)
        .json({ user: JSON.parse(cachedProfile), cached: true });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Cache the result for future requests (expires in 3600 seconds)
    await cacheDocument(cacheKey,JSON.stringify(user));

    res.status(200).json({ user, cached: false });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;
    // Update MongoDB record
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Invalidate the cache
    const cacheKey = `user:${userId}`;
    await deleteCachedDocument(cacheKey);
    
    res.status(200).json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }};

  exports.deleteUser = async (req, res) => {
    try {
      const userId = req.user._id;
      if (userId || req.user.role =="admin"){
      const deletedUser = await User.findByIdAndDelete(userId);
      
      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
    }
      
      const cacheKey = `user:${userId}`;
      await deleteCachedDocument(cacheKey);
      
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  };
>>>>>>> features
