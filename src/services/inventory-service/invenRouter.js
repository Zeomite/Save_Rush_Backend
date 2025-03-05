const express = require('express');
const itemRouter = express.Router();
const itemController = require('./invenController');
const { auth, authorize } = require('../../middlewares/auth');

// Query validation middleware
const validateListQuery = (req, res, next) => {
  const { minPrice, maxPrice, page, limit } = req.query;
  
  // Validate price range
  if (minPrice && isNaN(minPrice)) {
    return res.status(400).json({ message: 'minPrice must be a number' });
  }
  if (maxPrice && isNaN(maxPrice)) {
    return res.status(400).json({ message: 'maxPrice must be a number' });
  }
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
  }

  // Validate pagination
  if (page && (isNaN(page) || Number(page) < 1)) {
    return res.status(400).json({ message: 'page must be a positive number' });
  }
  if (limit && (isNaN(limit) || Number(limit) < 1)) {
    return res.status(400).json({ message: 'limit must be a positive number' });
  }

  next();
};

// Public endpoints for browsing items
itemRouter.get('/', validateListQuery, itemController.listItems);
itemRouter.get('/:itemId', itemController.getItem);

// Protected endpoints for managing items (admin-only access)
itemRouter.post('/', auth, authorize('admin'), itemController.createItem);
itemRouter.put('/:itemId', auth, authorize('admin'), itemController.updateItem);
itemRouter.delete('/:itemId', auth, authorize('admin'), itemController.deleteItem);

module.exports = itemRouter;
