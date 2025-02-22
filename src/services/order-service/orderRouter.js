
const express = require('express');
const orderRouter = express.Router();
const orderController = require('./orderController');
const { auth , authorize } = require('../../middlewares/auth');

// Create a new order (customer)
orderRouter.post('/', auth , orderController.createOrder);

// Get a specific order by its ID
orderRouter.get('/:orderId', auth , orderController.getOrderById);

// List all orders for the current user
orderRouter.get('/', auth , orderController.listOrders);

// Vendor accepts an order
orderRouter.put('/:orderId/accept', auth, authorize('vendor'), orderController.acceptOrder);

// Customer cancels an order (if allowed)
orderRouter.put('/:orderId/cancel', auth, authorize('customer'), orderController.cancelOrder);

// Update order status (for admin/delivery updates)
orderRouter.put('/:orderId/update', auth, authorize(['admin', 'delivery']), orderController.updateOrderStatus);

module.exports = orderRouter;
