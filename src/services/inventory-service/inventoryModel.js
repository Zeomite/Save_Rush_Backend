const mongoose = require('mongoose');
const { Schema } = mongoose;

const ItemSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String },
  brand: { type: String },
  imageUrl: { type: String },
  stock: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Add text index for search
ItemSchema.index({ name: 'text', description: 'text' });
// Add compound index for common queries
ItemSchema.index({ category: 1, brand: 1, price: 1 });

module.exports = mongoose.model('Item', ItemSchema);

exports.listItems = async (req, res) => {
  try {
    const {
      minPrice,
      maxPrice,
      category,
      sort,
      brand,
      search,
    } = req.query;

    // Build query object
    let query = {};

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Brand filter 
    if (brand) {
      query.brand = brand;
    }

    // Text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    let sortQuery = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortQuery[field] = order === 'desc' ? -1 : 1;
    }

    // Execute query
    const items = await Item.find(query)
      .sort(sortQuery)
      .exec();

    res.json({ items });

  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Error fetching items', error: error.message });
  }
};
