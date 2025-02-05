const express = require('express');
const userRouter = express.Router();
const { 
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
} = require('./userController');
const auth = require('../../middlewares/auth');

// Public routes
userRouter.post('/signup', signup);
userRouter.post('/login', login);

// Password reset routes (public)
userRouter.post('/password/reset-request', requestPasswordReset);
userRouter.post('/password/reset', resetPassword);

// Verification routes (public, no auth required)
userRouter.post('/verify/email/send', sendEmailVerificationCode);
userRouter.post('/verify/email', verifyEmailCode);
userRouter.post('/verify/phone/send', sendPhoneVerification);
userRouter.post('/verify/phone', verifyPhoneCode);
userRouter.get('/verify/status', checkVerificationStatus);

// Protected routes (require auth and verification)
userRouter.use(auth);
userRouter.get('/profile', getProfile);

module.exports = userRouter;