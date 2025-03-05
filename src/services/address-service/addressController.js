const Address = require("../models/Address");
const User = require("../models/User");

// Get addresses by userId
exports.getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.id });
    res.json(addresses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add new address
exports.addAddress = async (req, res) => {
  try {
    const { address, state, city, pincode, location } = req.body;
    const newAddress = new Address({
      userId: req.user.id,
      address,
      state,
      city,
      pincode,
      location,
    });
    const savedAddress = await newAddress.save();
    res.json(savedAddress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update address
exports.updateAddress = async (req, res) => {
  try {
    const { address, state, city, pincode, location } = req.body;
    const updatedAddress = await Address.findOneAndUpdate(
      {userId: req.user.id},
      { address, state, city, pincode, location },
      { new: true }
    );
    res.json(updatedAddress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    await Address.findByIdAndDelete(req.params.id);
    res.json({ message: "Address deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
