const express = require('express');
const router = express.Router();
const SecurityController = require('../controllers/securityController');

router.post('/injection-sandbox', SecurityController.testInjectionSandbox);
router.get('/constraints', SecurityController.inspectConstraints);

module.exports = router;
