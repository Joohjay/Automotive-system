import { Router } from 'express';

import {
  createProduct,
  getProduct,
  listProducts,
  setProductStatus,
  updateProduct,
} from '../controllers/product.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', requirePermission('product.create'), createProduct);
router.put('/:id', requirePermission('product.update'), updateProduct);
router.patch('/:id/status', requirePermission('product.update'), setProductStatus);

export default router;