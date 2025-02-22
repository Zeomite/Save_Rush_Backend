const express = require('express');
const vendorRouter = express.Router();
const vendorController = require('./vendorController');

// Route for publishing an order request to nearby vendors
vendorRouter.post('/publish-order-request', vendorController.publishOrderRequest);

// Route for a vendor to accept an order request
vendorRouter.post('/accept-order-request', vendorController.acceptOrderRequest);

module.exports = vendorRouter;
