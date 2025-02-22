const { getCachedDocument, cacheDocument, deleteCachedDocument } = require('../../utils/redisClient');
const Cart = require('./cartModel');

/**
 * Retrieve the cart for the current user.
 */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = `cart:${userId}`;

    // Try to fetch cart from Redis cache
    const cachedCart = await getCachedDocument(cacheKey);
    if (cachedCart) {
      return res.json({ cart: JSON.parse(cachedCart), cached: true });
    }

    // Fetch from MongoDB if not cached
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      // Create a new cart if one doesn't exist
      cart = new Cart({ user: userId, items: [] });
      await cart.save();
    }

    // Cache the cart with a shorter TTL (e.g., 5 minutes)
    await cacheDocument(cacheKey, 300, JSON.stringify(cart));

    res.json({ cart, cached: false });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
};

/**
 * Add an item to the cart.
 * Expects: { productId, quantity } in req.body.
 */
exports.addItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;
    
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }
    
    // Check if the product already exists in the cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );
    
    if (existingItem) {
      // Increase the quantity if the item is already in the cart
      existingItem.quantity += quantity;
    } else {
      // Add new item to cart
      cart.items.push({ product: productId, quantity });
    }
    
    cart.updatedAt = new Date();
    await cart.save();

    // Invalidate the cached cart for this user
    const cacheKey = `cart:${userId}`;
    await deleteCachedDocument(cacheKey);
    
    res.status(201).json({ message: 'Item added to cart', cart });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ message: 'Error adding item to cart', error: error.message });
  }
};

/**
 * Update the quantity of an item in the cart.
 * Expects: { productId, quantity } in req.body.
 */
exports.updateItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;
    
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const item = cart.items.find(
      (item) => item.product.toString() === productId
    );
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    item.quantity = quantity;
    cart.updatedAt = new Date();
    await cart.save();

    // Invalidate the cached cart for this user
    const cacheKey = `cart:${userId}`;
    await deleteCachedDocument(cacheKey);
    
    res.json({ message: 'Cart updated', cart });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ message: 'Error updating cart', error: error.message });
  }
};

/**
 * Remove an item from the cart.
 */
exports.removeItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;
    
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    cart.items = cart.items.filter(
      (item) => item._id.toString() !== itemId
    );
    cart.updatedAt = new Date();
    await cart.save();

    // Invalidate the cached cart for this user
    const cacheKey = `cart:${userId}`;
    await deleteCachedDocument(cacheKey);
    
    res.json({ message: 'Item removed from cart', cart });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ message: 'Error removing item from cart', error: error.message });
  }
};

/**
 * Clear all items from the cart.
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    cart.items = [];
    cart.updatedAt = new Date();
    await cart.save();

    // Invalidate the cached cart for this user
    const cacheKey = `cart:${userId}`;
    await redisClient.del(cacheKey);
    
    res.json({ message: 'Cart cleared', cart });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Error clearing cart', error: error.message });
  }
};
