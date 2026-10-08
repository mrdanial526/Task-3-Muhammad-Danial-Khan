const express = require('express');
const router = express.Router();
const TagController = require('../controllers/tagController');
const validate = require('../middleware/validator');
const { createTagSchema } = require('../schemas/tagSchema');

router.get('/', TagController.listTags);
router.post('/', validate(createTagSchema), TagController.createTag);
router.delete('/:id', TagController.deleteTag);

module.exports = router;
