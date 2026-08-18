import { Router } from 'express';

import {
  createBrand,
  createCategory,
  createLocation,
  getBusinessSettings,
  listBranchesRef,
  listBrands,
  listCategories,
  listLocations,
  listRoles,
  updateBrand,
  updateCategory,
  updateLocation,
} from '../controllers/referenceData.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/categories', listCategories);
router.post('/categories', requirePermission('product.create'), createCategory);
router.put('/categories/:id', requirePermission('product.update'), updateCategory);

router.get('/brands', listBrands);
router.post('/brands', requirePermission('product.create'), createBrand);
router.put('/brands/:id', requirePermission('product.update'), updateBrand);

router.get('/locations', listLocations);
router.post('/locations', requirePermission('product.create'), createLocation);
router.put('/locations/:id', requirePermission('product.update'), updateLocation);

router.get('/settings', getBusinessSettings);

router.get('/roles', listRoles);

router.get('/branches', listBranchesRef);

export default router;