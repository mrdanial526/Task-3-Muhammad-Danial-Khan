const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');

router.get('/health', SystemController.getHealth);
router.get('/integrity', SystemController.checkIntegrity);
router.get('/metrics', SystemController.getMetrics);
router.get('/schema', SystemController.getSchema);

module.exports = router;
