<<<<<<< HEAD
const express = require('express');
const deliveryRouter = express.Router();




module.exports = deliveryRouter;
=======
const express = require('express');
const deliveryRouter = express.Router();
const deliveryController = require('./deliveryController');

// Route to publish a delivery assignment request (based on vendor's accepted location)
deliveryRouter.post('/publish-assignment-request', deliveryController.publishDeliveryAssignmentRequest);

// Route for a delivery agent to accept a delivery assignment
deliveryRouter.post('/accept-assignment', deliveryController.acceptDeliveryAssignment);

module.exports = deliveryRouter;
>>>>>>> features
