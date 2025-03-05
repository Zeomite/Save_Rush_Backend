const { getCachedDocument, cacheDocument, deleteCachedDocument } = require('../../utils/redisClient');
const Item = require('./inventoryModel');

/**
 * List all items in the catalog.
 */
exports.listItems = async (req, res) => {
  try {
    const {
      minPrice,
      maxPrice,
      category,
      sort,
      brand,
      search,
      page = 1,
      limit = 10
    } = req.query;

    // Build cache key based on query parameters
    const cacheKey = `items:${JSON.stringify({ 
      minPrice, maxPrice, category, sort, brand, search, page, limit 
    })}`;

    // Try to get cached results
    const cachedItems = await getCachedDocument(cacheKey);
    if (cachedItems) {
      return res.json({ items: JSON.parse(cachedItems), cached: true });
    }

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
    } else {
      // Default sort by createdAt descending
      sortQuery = { createdAt: -1 };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const items = await Item.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit))
      .exec();

    // Get total count for pagination
    const total = await Item.countDocuments(query);

    const response = {
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    };

    // Cache the results for 5 minutes
    await cacheDocument(cacheKey, JSON.stringify(response), 300);

    res.json({ ...response, cached: false });

  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ 
      message: 'Error fetching items', 
      error: error.message 
    });
  }
};

/**
 * Get details of a single item by its ID.
 */
exports.getItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const cacheKey = `items:${ItemId}`;
    
        // Try to retrieve orders from Redis cache
        const cachedOrders = await getCachedDocument(cacheKey);
        if (cachedOrders) {
          return res.json({ orders: JSON.parse(cachedOrders) });
        }
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    await cacheDocument(cacheKey,JSON.stringify(item))
    res.json({ item });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ message: 'Error fetching item', error: error.message });
  }
};

/**
 * Create a new item.
 * Expects: { name, description, price, imageUrl } in req.body.
 */
exports.createItem = async (req, res) => {
  try {
    const { name, description, price, imageUrl } = req.body;
    const newItem = new Item({ name, description, price, imageUrl });
    await newItem.save();
    res.status(201).json({ message: 'Item created successfully', item: newItem });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Error creating item', error: error.message });
  }
};

/**
 * Update an existing item.
 */
exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const updatedData = req.body;
    const item = await Item.findByIdAndUpdate(itemId, updatedData, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    await deleteCachedDocument(`items:${ItemId}`);
    res.json({ message: 'Item updated successfully', item });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
};

/**
 * Delete an item.
 */
exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await Item.findByIdAndDelete(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    await deleteCachedDocument(`items:${ItemId}`);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
};
