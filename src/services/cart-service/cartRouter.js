const express = require('express');
const cartRouter = express.Router();
const cartController = require('./cartController');
const { auth } = require('../../middlewares/auth');

// All cart operations require authentication
cartRouter.use(auth);

// Get current user's cart
cartRouter.get('/', cartController.getCart);

// Add an item to the cart
cartRouter.post('/add', cartController.addItem);

// Update an item quantity in the cart
cartRouter.put('/update', cartController.updateItem);

// Remove an item from the cart
cartRouter.delete('/remove/:itemId', cartController.removeItem);

// Clear the entire cart
cartRouter.delete('/clear', cartController.clearCart);

cartRouter.post('/checkout', cartController.createOrderFromCart);

module.exports = cartRouter;
