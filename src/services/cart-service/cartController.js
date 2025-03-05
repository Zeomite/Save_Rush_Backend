const { getCachedDocument, cacheDocument, deleteCachedDocument } = require('../../utils/redisClient');
const Item = require('../inventory-service/inventoryModel');
const Address = require('../address-service/addressModel');
const Order = require("../order-service/orderModel");
const { initiateOrderRequest } = require('../vendor-service/vendorController');

exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = `cart:${userId}`;

    let cachedCart = await getCachedDocument(cacheKey);
    if (cachedCart) {
      let cart = JSON.parse(cachedCart);

      // For each item in the cached cart, perform a lookup to fetch the latest product details.
      const updatedItems = await Promise.all(
        cart.items.map(async (item) => {
          // Find fresh product details
          const freshProduct = await Item.findById(item.product._id);
          // Use the fresh product if available; otherwise, fall back to the cached version.
          return {
            product: freshProduct || item.product,
            quantity: item.quantity
          };
        })
      );

      // Update the cart's items with the fresh details.
      cart.items = updatedItems;

      // Recalculate the total price using the updated product prices.
      cart.totalPrice = updatedItems.reduce((total, item) => {
        const price = item.product ? item.product.price : 0;
        return total + price * item.quantity;
      }, 0);

      cart.updatedAt = new Date();

      // Optionally update the cache with the fresh data.
      await cacheDocument(cacheKey, JSON.stringify(cart), 300);

      return res.json({ cart, cached: true });
    }

    // If no cached cart exists, initialize a new empty cart.
    const newCart = { items: [], totalPrice: 0, updatedAt: new Date() };
    await cacheDocument(cacheKey, JSON.stringify(newCart), 300);
    res.json({ cart: newCart, cached: false });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
};


/**
 * Add an item to the cart stored in Redis.
 * Expects: { productId, quantity } in req.body.
 * Updates the total price field as well.
 */
exports.addItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;
    const cacheKey = `cart:${userId}`;

    // Fetch product details from the inventory
    const product = await Item.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let cartData = await getCachedDocument(cacheKey);
    let cart;
    if (cartData) {
      cart = JSON.parse(cartData);
    } else {
      cart = { items: [], totalPrice: 0, updatedAt: new Date() };
    }

    // Check if the product already exists in the cart
    const existingItem = cart.items.find(
      (item) => item.product._id.toString() === productId
    );

    if (existingItem) {
      // Increase the quantity and update total price
      existingItem.quantity += quantity;
      cart.totalPrice += product.price * quantity;
    } else {
      // Add new item to cart and update total price
      cart.items.push({ product, quantity });
      cart.totalPrice += product.price * quantity;
    }
    cart.updatedAt = new Date();

    await cacheDocument(cacheKey, JSON.stringify(cart), 300);

    res.status(201).json({ message: 'Item added to cart', cart });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ message: 'Error adding item to cart', error: error.message });
  }
};

/**
 * Update the quantity of an item in the Redis cart.
 * Expects: { productId, quantity } in req.body.
 * Recalculates the total price based on the difference.
 */
exports.updateItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;
    const cacheKey = `cart:${userId}`;

    let cartData = await getCachedDocument(cacheKey);
    if (!cartData) return res.status(404).json({ message: 'Cart not found' });

    let cart = JSON.parse(cartData);
    const item = cart.items.find(
      (item) => item.product._id.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    // Calculate difference and update total price accordingly
    const diff = quantity - item.quantity;
    item.quantity = quantity;
    cart.totalPrice += diff * item.product.price;
    cart.updatedAt = new Date();

    await cacheDocument(cacheKey, JSON.stringify(cart), 300);

    res.json({ message: 'Cart updated', cart });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ message: 'Error updating cart', error: error.message });
  }
};

/**
 * Remove an item from the Redis cart.
 * Expects product id (itemId) in req.params.
 * Updates the total price field after removal.
 */
exports.removeItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params; // Here, itemId represents the productId.
    const cacheKey = `cart:${userId}`;

    let cartData = await getCachedDocument(cacheKey);
    if (!cartData) return res.status(404).json({ message: 'Cart not found' });

    let cart = JSON.parse(cartData);
    const itemIndex = cart.items.findIndex(
      (item) => item.product._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    // Update total price before removing the item
    const removedItem = cart.items[itemIndex];
    cart.totalPrice -= removedItem.product.price * removedItem.quantity;
    cart.items.splice(itemIndex, 1);
    cart.updatedAt = new Date();

    await cacheDocument(cacheKey, JSON.stringify(cart), 300);

    res.json({ message: 'Item removed from cart', cart });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ message: 'Error removing item from cart', error: error.message });
  }
};

/**
 * Clear the Redis cart.
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = `cart:${userId}`;

    // Reset the cart to an empty state
    const newCart = { items: [], totalPrice: 0, updatedAt: new Date() };
    await cacheDocument(cacheKey, JSON.stringify(newCart), 300);

    res.json({ message: 'Cart cleared', cart: newCart });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Error clearing cart', error: error.message });
  }
};

/**
 * Create an order from the Redis cart.
 * Expects: { addressId } in req.body.
 * Uses the cart from Redis to build the order and then clears the cart.
 */
exports.createOrderFromCart = async (req, res) => {
  try {
    const { addressId } = req.body;
    const address = await Address.findById(addressId);
    if (!address) return res.status(404).json({ error: "Address not found" });

    const userId = req.user._id;
    const cacheKey = `cart:${userId}`;

    let cachedCart = await getCachedDocument(cacheKey);
    if (!cachedCart) return res.status(400).json({ error: "Cart is empty" });

    cachedCart = JSON.parse(cachedCart);
    if (!cachedCart.items || cachedCart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Create order using the cart's items and total price
    const order = await Order.create({
      userId: req.user._id,
      items: cachedCart.items,
      totalPrice: cachedCart.totalPrice,
      deliveryAddress: addressId,
    });

    // Clear the cart in Redis after creating the order
    await deleteCachedDocument(cacheKey);
    res.json(order);
    initiateOrderRequest(order._id, address.location)
  } catch (err) {
    console.error('Error creating order from cart:', err);
    res.status(500).json({ error: err.message });
  }
};
