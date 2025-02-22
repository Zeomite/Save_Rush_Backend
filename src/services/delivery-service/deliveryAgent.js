const mongoose = require('mongoose');
const { Schema } = mongoose;

const DeliveryAgentSchema = new Schema({
  name: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  // GeoJSON location for agent (for proximity queries)
  currentLocation: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeliveryAgent', DeliveryAgentSchema);
