import { Router } from 'express';

import {
  cancelPurchase,
  createPurchase,
  getPurchase,
  listPurchases,
  receivePurchase,
} from '../controllers/purchase.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/', requirePermission('purchase.create'), createPurchase);
router.post('/:id/receive', requirePermission('purchase.receive'), receivePurchase);
router.post('/:id/cancel', requirePermission('purchase.cancel'), cancelPurchase);

export default router;