const express = require('express');
const router = express.Router();
const vendorController = require('./vendorController');
const {auth,authorize} = require('../../middlewares/auth');

// Endpoint to initiate an order request (generates and publishes the vendor list)
router.post('/initiate-request', auth, authorize(['vendor']),vendorController.initiateOrderRequest);

// Endpoint for a vendor to accept the order request
router.post('/accept-request', auth, authorize(['vendor']), vendorController.acceptOrderRequest);

// Endpoint for a vendor to deny the order request
router.post('/deny-request', auth, authorize(['vendor']),  vendorController.denyOrderRequest);

// SSE endpoint for continuously streaming order requests to the vendor
router.get('/stream-order-requests', auth,authorize(['vendor']), vendorController.streamOrderRequests);

module.exports = router;
