
const Delivery = require('./deliveryModel');
const DeliveryAgent = require('./deliveryAgent');
const eventBus = require('../../utils/eventBus');
const Order = require('../../services/order-service/orderModel');

/**
 * In-memory pending acceptances for delivery assignments.
 * Key format: `${orderId}:${agentId}`
 * NOTE: In production, use a distributed lock or a shared cache.
 */
const pendingDeliveryAcceptances = {};

/**
 * Utility function that returns a promise which resolves if the agent accepts
 * within the given timeout, and rejects if the timeout is reached.
 *
 * @param {String} orderId
 * @param {String} agentId
 * @param {Number} timeout Timeout in milliseconds (default: 20000)
 */
const waitForDeliveryAcceptance = (orderId, agentId, timeout = 20000) => {
  return new Promise((resolve, reject) => {
    const key = `${orderId}:${agentId}`;
    pendingDeliveryAcceptances[key] = resolve;
    setTimeout(() => {
      if (pendingDeliveryAcceptances[key]) {
        delete pendingDeliveryAcceptances[key];
        reject(new Error('Timeout'));
      }
    }, timeout);
  });
};

/**
 * Publish a delivery assignment request to candidate delivery agents.
 * Expects in req.body:
 *   - orderId: The ID of the order for which delivery is needed.
 *   - vendorLocation: The vendor's location (GeoJSON Point, e.g., { coordinates: [lng, lat] }).
 *
 * The process:
 * 1. Query for available delivery agents near the vendor location (within 5km).
 * 2. Iterate over candidate agents sequentially.
 * 3. For each candidate, publish a targeted event and wait up to 20 seconds for acceptance.
 * 4. Return the first agent that accepts the assignment.
 */
exports.publishDeliveryAssignmentRequest = async (req, res) => {
  try {
    const { orderId, vendorLocation } = req.body;
    
    // Find candidate delivery agents near the vendor's location.
    const candidates = await DeliveryAgent.find({
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: vendorLocation.coordinates },
          $maxDistance: 5000 // within 5 km
        }
      }
    });
    
    if (candidates.length === 0) {
      return res.status(404).json({ message: 'No available delivery agents found near the vendor location' });
    }
    
    let acceptedAgent = null;
    
    // Iterate through candidate agents sequentially.
    for (const agent of candidates) {
      // Publish a targeted event to the agent.
      await eventBus.publish(`delivery_assignment_request_to_agent_${agent._id}`, {
        orderId,
        vendorLocation,
        timeout: 20000 // 20-second window
      });
      
      try {
        // Wait for this agent to accept.
        await waitForDeliveryAcceptance(orderId, agent._id, 20000);
        acceptedAgent = agent;
        break;
      } catch (err) {
        // Timeout for this agent; continue with the next candidate.
        continue;
      }
    }
    
    if (!acceptedAgent) {
      return res.status(404).json({ message: 'No delivery agent accepted the assignment within the time window' });
    }
    
    // Respond with the accepted agent's details.
    res.json({ message: 'Delivery agent accepted the assignment', agent: acceptedAgent });
  } catch (error) {
    console.error('Error publishing delivery assignment request:', error);
    res.status(500).json({ message: 'Error publishing assignment request', error: error.message });
  }
};

/**
 * Endpoint for a delivery agent to accept a delivery assignment.
 * Expects in req.body:
 *   - orderId: The ID of the order.
 *   - agentId: The ID of the delivery agent accepting the assignment.
 *
 * This function performs an atomic update on the Delivery record so that only one agent can claim it.
 * Once accepted, the agent is marked as busy, and the pending acceptance is resolved.
 */
exports.acceptDeliveryAssignment = async (req, res) => {
  try {
    const { orderId, agentId } = req.body;
    
    // Attempt to update the Delivery record atomically (only if still pending).
    const delivery = await Delivery.findOneAndUpdate(
      { order: orderId, status: 'pending' },
      { status: 'assigned', agent: agentId, updatedAt: new Date(), assignedAt: new Date() },
      { new: true }
    );
    
    if (!delivery) {
      return res.status(400).json({ message: 'Assignment already accepted or invalid order' });
    }
    
    // Mark the delivery agent as busy.
    await DeliveryAgent.findByIdAndUpdate(agentId, { isAvailable: false });
    
    // Resolve the pending acceptance so that the waiting loop in publishDeliveryAssignmentRequest can continue.
    const key = `${orderId}:${agentId}`;
    if (pendingDeliveryAcceptances[key]) {
      pendingDeliveryAcceptances[key](true);
      delete pendingDeliveryAcceptances[key];
    }
    
    // Publish a confirmation event.
    await eventBus.publish('delivery_agent_assigned', {
      orderId,
      agentId,
      acceptedAt: delivery.assignedAt
    });
    
    res.json({ message: 'Delivery assignment accepted', delivery });
  } catch (error) {
    console.error('Error accepting delivery assignment:', error);
    res.status(500).json({ message: 'Error accepting delivery assignment', error: error.message });
  }
};
