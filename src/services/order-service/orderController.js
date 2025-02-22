
const { cacheDocument } = require('../../utils/redisClient');
const Order = require('./orderModel'); // Ensure you've created an Order model accordingly

/**
 * Create a new order.
 * Expects: { items, deliveryAddress, paymentMethod } in req.body.
 * Assumes authenticated user is available in req.user.
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cartId, deliveryAddress, paymentMethod } = req.body;

    // Create a new order with initial status 'pending'
    const newOrder = new Order({
      user: userId,
      cartId,
      deliveryAddress,
      paymentMethod,
      status: 'pending',
      createdAt: new Date()
    });

    await newOrder.save();

    const cacheKey = `orders:${userId}`;
    await deleteCachedDocument(cacheKey);

    res.status(201).json({
      message: 'Order created successfully',
      order: newOrder
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

/**
 * Retrieve an order by its ID.
 */
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('user', 'username phonenumber');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

/**
 * List all orders for the currently authenticated user.
 */
exports.listOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = `orders:${userId}`;

    // Try to retrieve orders from Redis cache
    const cachedOrders = await getCachedDocument(cacheKey);
    if (cachedOrders) {
      return res.json({ orders: JSON.parse(cachedOrders), cached: true });
    }

    // Fetch orders from MongoDB if not cached
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    // Cache the orders for 1 hour (3600 seconds)
    await cacheDocument(cacheKey, 3600, JSON.stringify(orders));

    res.json({ orders, cached: false });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

/**
 * Vendor accepts an order.
 * Only vendors are authorized to hit this endpoint.
 */
exports.acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const vendorId = req.user._id; // Vendor information from auth middleware

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order has already been processed' });
    }

    // Update order status and assign vendor
    order.status = 'accepted';
    order.vendor = vendorId;
    order.updatedAt = new Date();

    await order.save();

    // Optionally, invalidate cache for the user who placed the order:
    const cacheKey = `orders:${order.user}`;
    await redisClient.del(cacheKey);

    res.json({
      message: 'Order accepted successfully',
      order
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({ message: 'Error accepting order', error: error.message });
  }
};

/**
 * Customer cancels an order (if in a cancellable state).
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Allow cancellation only if order is still pending
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order cannot be canceled at this stage' });
    }

    order.status = 'canceled';
    order.updatedAt = new Date();
    await order.save();

    // Invalidate cache for the user who placed the order
    const cacheKey = `orders:${order.user}`;
    await redisClient.del(cacheKey);

    res.json({
      message: 'Order canceled successfully',
      order
    });
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ message: 'Error canceling order', error: error.message });
  }
};

/**
 * Update order status (for admin or delivery updates).
 * Expects { status } in req.body.
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const validStatuses = ['accepted', 'in_transit', 'delivered', 'canceled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    // Invalidate cache for the user who placed the order
    const cacheKey = `orders:${order.user}`;
    await redisClient.del(cacheKey);

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
