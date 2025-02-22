const express = require('express');
const itemRouter = express.Router();
const itemController = require('./invenController');

// Public endpoints for browsing items
itemRouter.get('/', itemController.listItems);
itemRouter.get('/:itemId', itemController.getItem);

// Protected endpoints for managing items (admin-only access)

itemRouter.post('/', itemController.createItem);
itemRouter.put('/:itemId', itemController.updateItem);
itemRouter.delete('/:itemId', itemController.deleteItem);

module.exports = itemRouter;
