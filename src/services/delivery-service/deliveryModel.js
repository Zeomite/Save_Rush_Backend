const mongoose = require('mongoose');
const { Schema } = mongoose;

const DeliverySchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  agent: { type: Schema.Types.ObjectId, ref: 'DeliveryAgent' }, // will be assigned later
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'canceled'], 
    default: 'pending' 
  },
  assignedAt: { type: Date },
  updatedAt: { type: Date }
});

module.exports = mongoose.model('Delivery', DeliverySchema);
