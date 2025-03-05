const Vendor = require('./vendorModel');
const Order = require('../../services/order-service/orderModel');
const eventBus = require('../../utils/eventBus');
const deliveryModel = require('../delivery-service/deliveryModel');

// Global in-memory store for vendor lists per order.
// Structure: { [orderId]: [vendorObject, vendorObject, ...] }
const orderVendorLists = {};

/**
 * Initiate Order Request API
 * Expects in req.body:
 *   - orderId: The ID of the order.
 *   - vendorProximityLocation: A GeoJSON Point object (e.g., { coordinates: [longitude, latitude] }).
 *
 * Process:
 *   1. Find available vendors near the provided location (within 10 km) sorted by proximity.
 *   2. Save the sorted list in memory (orderVendorLists) keyed by orderId.
 *   3. Publish the order request to the first vendor on the list.
 */
exports.initiateOrderRequest = async (orderId, vendorProximityLocation) =>{
  try{
    // Find candidate vendors sorted by distance (within 10 km)
    const vendors = await Vendor.find({
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: vendorProximityLocation.coordinates },
          $maxDistance: 10000
        }
      }
    });
    
    if (!vendors || vendors.length === 0) {
      return res.status(404).json({ message: 'No nearby vendors available' });
    }
    
    // Save the sorted vendor list for this order in our in-memory map.
    orderVendorLists[orderId] = vendors;
    
    // Publish to the first vendor in the list.
    const firstVendor = vendors[0];
    await eventBus.publish(`order_request_to_vendor_${firstVendor._id}`, {
      orderId,
      vendorList: vendors.map(v => v._id), // send only vendor IDs if desired
    });
    
    return res.json({
      message: 'Order request initiated and sent to first vendor',
      vendorList: vendors.map(v => v._id),
    });
  } catch (error) {
    console.error('Error initiating order request:', error);
    return res.status(500).json({ message: 'Error initiating order request', error: error.message });
  }
};

/**
 * Accept Order Request API
 * Expects in req.body:
 *   - orderId: The ID of the order.
 *   - vendorId: The vendor's ID (should match the first vendor in the list).
 *   - vendorLocation: The vendor's current location as a GeoJSON Point.
 *
 * Process:
 *   - Atomically update the order schema: set status to 'accepted' and record vendor info.
 */
exports.acceptOrderRequest = async (req, res) => {
  try {
    const { orderId, vendorId } = req.body;
    
    // Atomically update the order (only if no vendor has been assigned yet)
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, vendor: { $exists: false } },
      { vendor: vendorId , status: 'vendor_accepted', updatedAt: new Date() },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(400).json({ message: 'Order already accepted or not found' });
    }
    
    // Mark the vendor as busy
    await Vendor.findByIdAndUpdate(vendorId, { isAvailable: false });
    
    // Clear the vendor list for this order (assignment complete)
    delete orderVendorLists[orderId];
    
    // Publish an event that the order has been accepted (optional)
    await eventBus.publish('vendor_accepted_order', {
      orderId,
      vendorId,
      vendorLocation,
      acceptedAt: updatedOrder.updatedAt,
    });

    const deliveryAgent = await DeliveryAgent.findOneAndUpdate({
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: vendorLocation.coordinates },
          $maxDistance: 5000 // within 5 km; adjust as needed
        }
      }
    },
  { isAvailable: false},{new:true});
  
  const delivery = deliveryModel.create({order:orderId, agent: deliveryAgent._id,assignedAt: new Date()});    
    return res.json({ message: 'Order accepted by vendor', order: updatedOrder });
  } catch (error) {
    console.error('Error accepting order:', error);
    return res.status(500).json({ message: 'Error accepting order', error: error.message });
  }
};

/**
 * Deny Order Request API
 * Expects in req.body:
 *   - orderId: The ID of the order.
 *   - vendorId: The vendor's ID that is denying the request.
 *
 * Process:
 *   - Remove the vendor from the saved vendor list for the order.
 *   - If vendors remain in the list, publish the updated request to the new first vendor.
 */
exports.denyOrderRequest = async (req, res) => {
  try {
    const { orderId, vendorId } = req.body;
    
    let vendors = orderVendorLists[orderId];
    if (!vendors || vendors.length === 0) {
      return res.status(404).json({ message: 'No pending vendor list found for this order' });
    }
    
    // Remove the vendor who denied (assume it's the first vendor in the list)
    // Validate that the denying vendor is indeed the first vendor.
    if (vendors[0]._id.toString() !== vendorId) {
      return res.status(400).json({ message: 'Deny request from vendor not currently assigned' });
    }
    
    // Remove the first vendor from the list
    vendors.shift();
    
    // Update the global list
    orderVendorLists[orderId] = vendors;
    
    if (vendors.length === 0) {
      // No more vendors available
      return res.status(404).json({ message: 'No vendors left to receive the order request' });
    }
    
    // Publish the updated vendor list to the new first vendor.
    const newFirstVendor = vendors[0];
    await eventBus.publish(`order_request_to_vendor_${newFirstVendor._id}`, {
      orderId,
      vendorList: vendors.map(v => v._id),
    });
    
    return res.json({
      message: 'Order request denied. Forwarded to next vendor.',
      vendorList: vendors.map(v => v._id)
    });
  } catch (error) {
    console.error('Error processing deny order request:', error);
    return res.status(500).json({ message: 'Error processing deny order request', error: error.message });
  }
};


// backend/services/vendor-service/src/controllers.js

const redis = require('redis');

/**
 * SSE endpoint for streaming order requests to the vendor.
 * This endpoint keeps the connection open so that the vendor continuously
 * receives new order notifications published to the Redis channel.
 *
 * The vendor subscribes to a Redis channel named: `order_request_to_vendor_<vendorId>`
 * and receives all notifications as they arrive.
 */
exports.streamOrderRequests = async (req, res) => {
  try {
    const vendorId = req.user._id; // Authenticated vendor ID
    const channelName = `order_request_to_vendor_${vendorId}`;

    // Set SSE headers to keep the connection alive
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('\n'); // Ensures the connection is established

    // Create a new Redis subscriber client for this vendor
    const redisSub = redis.createClient({
      url: process.env.REDIS_URI || 'redis://localhost:6379'
    });

    redisSub.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });

    await redisSub.connect();
    await redisSub.subscribe(channelName, (message) => {
      // When a message is received on the vendor's channel, send it via SSE
      res.write(`data: ${message}\n\n`);
      // Note: The connection is not closed after sending the message;
      // it remains open to receive further notifications.
    });

    // Clean up when the client disconnects
    req.on('close', () => {
      console.log(`Vendor ${vendorId} disconnected from SSE.`);
      redisSub.unsubscribe(channelName);
      redisSub.quit();
      res.end();
    });
  } catch (error) {
    console.error('Error in streamOrderRequests:', error);
    res.status(500).end();
  }
};
