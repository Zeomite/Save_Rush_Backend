const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
  userId:{ type: Schema.Types.ObjectId, ref: 'User', required: true },
  carId: { type: Schema.Types.ObjectId, ref: 'Cart', required: true },
  deliveryAddress: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'vendor_accepted', 'canceled', 'completed'],
    default: ['pending'] 
  },
  // Will be populated once a vendor accepts the order.
  vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
},{
  timestamps:true
});

module.exports = mongoose.model('Order', OrderSchema);
