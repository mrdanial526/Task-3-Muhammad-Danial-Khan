const express = require('express');
const router = express.Router();

const userRoutes = require('./userRoutes');
const itemRoutes = require('./itemRoutes');
const folderRoutes = require('./folderRoutes');
const tagRoutes = require('./tagRoutes');
const academicRoutes = require('./academicRoutes');
const commerceRoutes = require('./commerceRoutes');
const securityRoutes = require('./securityRoutes');
const systemRoutes = require('./systemRoutes');

router.use('/users', userRoutes);
router.use('/items', itemRoutes);
router.use('/folders', folderRoutes);
router.use('/tags', tagRoutes);
router.use('/academics', academicRoutes);
router.use('/commerce', commerceRoutes);
router.use('/security', securityRoutes);
router.use('/system', systemRoutes);

module.exports = router;
