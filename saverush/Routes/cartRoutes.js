const express = require('express');
const Cart = require('../models/cartModel1');

const router = express.Router();

router.post('/add', async (req, res) => {
    try {
        const { userId, productId, quantity, totalPrice } = req.body;
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [{ productId, quantity }], totalPrice });
        } else {
            cart.items.push({ productId, quantity });
            cart.totalPrice += totalPrice;
        }

        await cart.save();
        res.status(201).json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.params.userId }).populate('items.productId');
        if (!cart) return res.status(404).json({ message: "Cart not found" });
        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/remove/:userId/:productId', async (req, res) => {
    try {
        let cart = await Cart.findOne({ userId: req.params.userId });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        cart.items = cart.items.filter(item => item.productId.toString() !== req.params.productId);
        cart.totalPrice = cart.items.reduce((total, item) => total + (item.quantity * item.price), 0);

        await cart.save();
        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
