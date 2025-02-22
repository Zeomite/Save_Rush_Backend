const express = require('express');
const userRouter = express.Router();
const {auth} = require('../../middlewares/auth');

const {
  login,
  getProfile,
updateUser,
deleteUser
} = require('./userController');

// Public Routes
userRouter.post('/login', login);

// Protected Routes (requires authentication and verification)
userRouter.use(auth);
userRouter.get('/profile', getProfile);
userRouter.patch('/update',updateUser)
userRouter.delete('/delete',deleteUser)

module.exports = userRouter;
