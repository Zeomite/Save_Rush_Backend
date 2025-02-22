const express = require('express');
const router = express.Router();

// Import service routers
const cartRouter = require('./services/cart-service/cartRouter');
const invenRouter = require('./services/inventory-service/invenRouter');
const orderRouter = require('./services/order-service/orderRouter');
const paymentRouter = require('./services/payment-service/paymentRouter');
const userRouter = require('./services/user-service/userRouter');
const vendorRouter = require('./services/vendor-service/vendorRouter');
const deliveryRouter = require('./services/delivery-service/deliveryRouter');

// Use service routers
router.use('/api/users', userRouter);
router.use('/api/orders', orderRouter);
router.use('/api/vendors', vendorRouter);
router.use('/api/cart', cartRouter);
router.use('/api/delivery',deliveryRouter)
//router.use('/api/payments', paymentRouter);
router.use('/api/items', invenRouter);

module.exports = router;