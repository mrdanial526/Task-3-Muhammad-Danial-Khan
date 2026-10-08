const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const validate = require('../middleware/validator');
const { createUserSchema, updateUserSchema, updateProfileSchema } = require('../schemas/userSchema');

// User CRUD
router.get('/', UserController.listUsers);
router.get('/:id', UserController.getUserById);
router.post('/', validate(createUserSchema), UserController.createUser);
router.put('/:id', validate(updateUserSchema), UserController.updateUser);
router.patch('/:id', validate(updateUserSchema), UserController.updateUser);
router.delete('/:id', UserController.deleteUser);

// 1:1 Profile Endpoints
router.get('/:id/profile', UserController.getUserProfile);
router.put('/:id/profile', validate(updateProfileSchema), UserController.updateUserProfile);
router.patch('/:id/profile', validate(updateProfileSchema), UserController.updateUserProfile);

module.exports = router;
