const express = require('express');
const { body } = require('express-validator');
const paymentRouter = express.Router();
const paymentController = require('./paymentController');
const { auth } = require('../../middlewares/auth');

// Route to create a new payment order
paymentRouter.post(
  '/create-payment-order',
  auth,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').isString().withMessage('Currency must be a string')
  ],
  paymentController.createPaymentOrder
);

// Route to handle Razorpay webhooks
paymentRouter.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = paymentRouter;
