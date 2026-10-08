const express = require('express');
const router = express.Router();
const CommerceController = require('../controllers/commerceController');
const validate = require('../middleware/validator');
const { createCustomerSchema, createOrderSchema } = require('../schemas/commerceSchema');

router.get('/customers', CommerceController.listCustomers);
router.get('/customers/:id', CommerceController.getCustomerById);
router.post('/customers', validate(createCustomerSchema), CommerceController.createCustomer);
router.post('/orders', validate(createOrderSchema), CommerceController.createOrder);

module.exports = router;
