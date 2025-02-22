
const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  paymentIntentId: { type: String, required: true },
  status: { type: String, default:"initiated" }
},{
  timestamps:true
});

module.exports = mongoose.model('Payment', PaymentSchema);
