const express = require('express');
const userRouter = express.Router();
const {auth} = require('../../middlewares/auth');

const {
  login,
  getProfile,
updateUser,
deleteUser,
streamVendorAcceptedOrder
} = require('./userController');

// Public Routes
userRouter.post('/login', login);

// Protected Routes (requires authentication and verification)
userRouter.use(auth);
userRouter.get('/profile', getProfile);
userRouter.patch('/update',updateUser)
userRouter.delete('/delete',deleteUser)
userRouter.get('/stream-order-requests', streamVendorAcceptedOrder);

module.exports = userRouter;
