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


/**
 * SSE endpoint to stream a "vendor accepted order" event to the user.
 * The client should call this endpoint (e.g., GET /api/users/notifications/stream)
 * optionally with a query parameter orderId. Once an event matching the user (and orderId, if provided)
 * is received, the server sends the event as JSON and then closes the SSE connection.
 */
exports.streamVendorAcceptedOrder = async (req, res) => {
  try {
    // Get the current user's ID from the auth middleware.
    const userId = req.user._id;
    // Optionally, the client may pass an orderId to filter on.
    const orderId = req.query.orderId;

    // Set the SSE headers.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    // Send an initial comment to establish the stream.
    res.write(': connected\n\n');

    // Define the callback to handle "vendor_accepted_order" events.
    const onVendorAccepted = (data) => {
      // Expecting data to have: { userId, orderId, vendorId, vendorLocation, acceptedAt }
      // Filter events by matching the userId (and orderId if provided).
      if (data.userId === userId && (!orderId || data.orderId === orderId)) {
        // Write the data as an SSE message.
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        // End the SSE stream after sending the event.
        res.end();
        // Unsubscribe from further events.
        eventBus.unsubscribe('vendor_accepted_order', onVendorAccepted);
      }
    };

    // Subscribe to the "vendor_accepted_order" topic.
    eventBus.subscribe('vendor_accepted_order', onVendorAccepted);

    // If the client disconnects before an event is received, unsubscribe.
    req.on('close', () => {
      eventBus.unsubscribe('vendor_accepted_order', onVendorAccepted);
      res.end();
    });
  } catch (error) {
    console.error('Error in streamVendorAcceptedOrder:', error);
    res.status(500).end();
  }
};
