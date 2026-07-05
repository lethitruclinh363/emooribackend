const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../middleware/auth');
const {
  getStorePackages,
  getStorePackagesAdmin,
  createStorePackage,
  updateStorePackage,
  deleteStorePackage,
} = require('../controllers/StoreControllers');

router.get('/', getStorePackages);

router.get('/admin', verifyToken, isAdmin, getStorePackagesAdmin);
router.post('/', verifyToken, isAdmin, createStorePackage);
router.put('/:id', verifyToken, isAdmin, updateStorePackage);
router.delete('/:id', verifyToken, isAdmin, deleteStorePackage);

module.exports = router;

