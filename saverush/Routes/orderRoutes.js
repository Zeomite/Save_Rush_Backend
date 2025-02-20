const express = require('express');
const Order = require('../models/orderModel1');

const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const { userId, vendorId, items, totalPrice } = req.body;
        const order = new Order({ userId, vendorId, items, totalPrice });
        await order.save();
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/user/:userId', async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.params.userId }).populate('items.productId');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/status/:orderId', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.orderId, { status: req.body.status }, { new: true });
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/assign-delivery/:orderId', async (req, res) => {
    try {
        const { deliveryId } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.orderId, { deliveryId, status: 'out-for-delivery' }, { new: true });
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
