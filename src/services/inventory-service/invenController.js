
const { getCachedDocument, cacheDocument, deleteCachedDocument } = require('../../utils/redisClient');
const Item = require('./inventoryModel');

/**
 * List all items in the catalog.
 */
exports.listItems = async (req, res) => {
  try {
   // Fetch items from MongoDB if not cached
   const items = await Item.find();
   res.json({... items});
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Error fetching items', error: error.message });
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
