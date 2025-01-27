const express = require('express');
const router = express.Router();

// Import service routers
const cartRouter = require('./services/cart-service/cartRouter');
const deliveryRouter = require('./services/delivery-service/deliveryRouter');
const invenRouter = require('./services/inventory-service/invenRouter');
const orderRouter = require('./services/order-service/orderRouter');
const paymentRouter = require('./services/payment-service/paymentRouter');
const userRouter = require('./services/user-service/userRouter');
const vendorRouter = require('./services/vendor-service/vendorRouter');

// Use service routers
router.use('/cart', cartRouter);
router.use('/delivery', deliveryRouter);
router.use('/inventory', invenRouter);
router.use('/order', orderRouter);
router.use('/payment', paymentRouter);
router.use('/user', userRouter);
router.use('/vendor', vendorRouter);

module.exports = router;
