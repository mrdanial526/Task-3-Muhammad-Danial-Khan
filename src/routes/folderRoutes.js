const express = require('express');
const router = express.Router();
const FolderController = require('../controllers/folderController');
const validate = require('../middleware/validator');
const { createFolderSchema, updateFolderSchema } = require('../schemas/folderSchema');

router.get('/', FolderController.listFolders);
router.get('/:id', FolderController.getFolderById);
router.post('/', validate(createFolderSchema), FolderController.createFolder);
router.put('/:id', validate(updateFolderSchema), FolderController.updateFolder);
router.patch('/:id', validate(updateFolderSchema), FolderController.updateFolder);
router.delete('/:id', FolderController.deleteFolder);

module.exports = router;
