const express = require('express');
const router = express.Router();
const ItemController = require('../controllers/itemController');
const validate = require('../middleware/validator');
const { createItemSchema, updateItemSchema } = require('../schemas/itemSchema');

router.get('/', ItemController.listItems);
router.get('/:id', ItemController.getItemById);
router.post('/', validate(createItemSchema), ItemController.createItem);
router.put('/:id', validate(updateItemSchema), ItemController.updateItem);
router.patch('/:id', validate(updateItemSchema), ItemController.updateItem);
router.delete('/:id', ItemController.deleteItem);

module.exports = router;
