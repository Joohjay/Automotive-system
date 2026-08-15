import { Router } from 'express';

import {
  createSupplier,
  getSupplier,
  listSuppliers,
  setSupplierStatus,
  updateSupplier,
} from '../controllers/supplier.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', listSuppliers);
router.get('/:id', getSupplier);
router.post('/', requirePermission('supplier.manage'), createSupplier);
router.patch('/:id', requirePermission('supplier.manage'), updateSupplier);
router.patch('/:id/status', requirePermission('supplier.manage'), setSupplierStatus);

export default router;