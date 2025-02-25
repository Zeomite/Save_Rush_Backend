const Razorpay = require('razorpay');
const Payment = require('./paymentModel');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a new payment order
 */
const createPaymentOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, currency } = req.body;
  try {
    if (!amount || !currency) {
      return res.status(400).json({ message: 'Amount and currency are required' });
    }

    const options = {
      amount: amount * 100, // amount in the smallest currency unit
      currency,
      receipt: `receipt_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
    const payment = new Payment({
      user: req.user._id,
      amount,
      currency,
      razorpayOrderId: order.id,
      status: 'created'
    });
    await payment.save();
    res.status(200).send({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
};

/**
 * Handle Razorpay webhook events
 */
const handleWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (digest === req.headers['x-razorpay-signature']) {
    const event = req.body.event;
    if (event === 'payment.captured') {
      const payment = req.body.payload.payment.entity;
      await Payment.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { status: 'succeeded', razorpayPaymentId: payment.id }
      );
    }
    res.status(200).send({ received: true });
  } else {
    console.error('Invalid signature:', req.headers['x-razorpay-signature']);
    res.status(400).send({ error: 'Invalid signature' });
  }
};

module.exports = {
  createPaymentOrder,
  handleWebhook,
};
