
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  role: { 
    type: String, 
    enum: ['customer', 'vendor', 'delivery', 'admin'],
    required: true,
    default: 'customer'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  }
},{
  timestamps:true
});

module.exports = mongoose.model('User', userSchema);
