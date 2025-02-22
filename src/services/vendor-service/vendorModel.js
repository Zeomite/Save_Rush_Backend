
const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  isAvailable: { type: Boolean, default: true },
  // Current location as GeoJSON Point ([longitude, latitude])
  currentLocation: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }
  }
},{
  timestamps:true
});

module.exports = mongoose.model('Vendor', VendorSchema);
