const Vendor = require('./vendorModel');
const Order = require('../../services/order-service/orderModel');
const eventBus = require('../../utils/eventBus');

/**
 * In-memory pending acceptance map.
 * NOTE: In production, use a distributed lock or a shared cache instead.
 * Key format: `${orderId}:${vendorId}`
 */
const pendingAcceptances = {};

/**
 * Utility function that returns a promise which resolves if the vendor accepts
 * within the given timeout, and rejects on timeout.
 *
 * @param {String} orderId
 * @param {String} vendorId
 * @param {Number} timeout Timeout in milliseconds (default: 20000)
 */
const waitForAcceptance = (orderId, vendorId, timeout = 20000) => {
  return new Promise((resolve, reject) => {
    const key = `${orderId}:${vendorId}`;
    pendingAcceptances[key] = resolve;
    setTimeout(() => {
      if (pendingAcceptances[key]) {
        delete pendingAcceptances[key];
        reject(new Error('Timeout'));
      }
    }, timeout);
  });
};

/**
 * Publish an order request to nearby vendors one-by-one.
 * Expects in req.body:
 *  - orderId: The order to be assigned.
 *  - vendorProximityLocation: An object with a GeoJSON Point format:
 *      { coordinates: [longitude, latitude] }.
 *
 * The process:
 * 1. Finds candidate vendors near the given location (e.g., within 10km).
 * 2. For each candidate, publishes a targeted event and waits up to 20 seconds for acceptance.
 * 3. Returns the first vendor that accepts the order.
 */
exports.publishOrderRequest = async (req, res) => {
  try {
    const { orderId, vendorProximityLocation } = req.body;
    
    // Find candidate vendors near the provided location.
    // Adjust $maxDistance (in meters) as needed.
    const candidates = await Vendor.find({
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: vendorProximityLocation.coordinates },
          $maxDistance: 10000 // within 10 km
        }
      }
    });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No nearby vendors available' });
    }
    
    let acceptedVendor = null;
    
    // Iterate through candidates sequentially.
    for (const vendor of candidates) {
      // Publish a targeted event to the vendor (using a channel naming convention).
      await eventBus.publish(`order_request_to_vendor_${vendor._id}`, {
        orderId,
        vendorProximityLocation,
        timeout: 20000 // inform vendor of the 20-second window
      });
      
      try {
        // Wait for the vendor to accept within 20 seconds.
        await waitForAcceptance(orderId, vendor._id, 20000);
        acceptedVendor = vendor;
        break; // Stop on first acceptance.
      } catch (err) {
        // Timeout for this vendor—proceed to the next candidate.
        continue;
      }
    }
    
    if (!acceptedVendor) {
      return res.status(404).json({ message: 'No vendor accepted the order within the time window' });
    }
    
    // Return the accepted vendor's details.
    return res.json({ message: 'Vendor accepted the order', vendor: acceptedVendor });
  } catch (error) {
    console.error('Error publishing order request:', error);
    return res.status(500).json({ message: 'Error publishing order request', error: error.message });
  }
};

/**
 * Endpoint for a vendor to accept an order.
 * Expects in req.body:
 *  - orderId: The ID of the order to accept.
 *  - vendorId: The ID of the vendor accepting the order.
 *  - vendorLocation: The vendor's current location (GeoJSON Point: { coordinates: [lng, lat] }).
 *
 * This function uses an atomic update so that only one vendor can claim the order.
 * If the update succeeds:
 *  - The order is updated with the vendor's details and marked as 'vendor_accepted'.
 *  - The vendor is marked as unavailable.
 *  - The pending acceptance is resolved.
 *  - An event is published to notify downstream systems.
 */
exports.acceptOrderRequest = async (req, res) => {
  try {
    const { orderId, vendorId, vendorLocation } = req.body;
    
    // Atomically update the order only if no vendor has been assigned.
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, vendor: { $exists: false } },
      { vendor: vendorId, vendorLocation, status: 'vendor_accepted', updatedAt: new Date() },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(400).json({ message: 'Order already accepted by another vendor or not found' });
    }
    
    // Mark the vendor as busy.
    await Vendor.findByIdAndUpdate(vendorId, { isAvailable: false });
    
    // Resolve the pending acceptance promise for this order and vendor.
    const key = `${orderId}:${vendorId}`;
    if (pendingAcceptances[key]) {
      pendingAcceptances[key](true);
      delete pendingAcceptances[key];
    }
    
    // Publish an event to confirm the vendor has accepted the order.
    await eventBus.publish('vendor_accepted_order', {
      orderId,
      vendorId,
      vendorLocation,
      acceptedAt: updatedOrder.updatedAt
    });
    
    res.json({ message: 'Order accepted by vendor', order: updatedOrder });
  } catch (error) {
    console.error('Error accepting order by vendor:', error);
    res.status(500).json({ message: 'Error accepting order', error: error.message });
  }
};
