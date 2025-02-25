const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("./userModel");
const {
  generateOTP,
  sendEmailOTP,
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
    const { uid, username, phoneNumber, role, email } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ message: 'Firebase UID and email are required' });
    }

    // Check if a user already exists
    const existingUser = await User.findOne({ 
      $or: [{ phoneNumber }, { email }] 
    });
    
    if (existingUser) {
      const token = generateToken(existingUser._id, existingUser.role);
      return res.json({
        message: "Login successful",
        token,
        user: existingUser
      });
    }

    // Create new user without setting _id explicitly
    const newUser = new User({
      username,
      email,
      role: role || 'customer',
      phoneNumber
    });
    
    await newUser.save();

    const token = generateToken(newUser._id, newUser.role);
    res.status(201).json({
      message: "User created successfully.",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        role: newUser.role,
        isEmailVerified: newUser.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: "Error creating user", 
      error: error.message 
    });
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
