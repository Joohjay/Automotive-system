import { Router } from 'express';

import {
  createSale,
  getSale,
  listSales,
  voidSale,
} from '../controllers/sale.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('sale.view'), listSales);
router.get('/:id', requirePermission('sale.view'), getSale);
router.post('/', requirePermission('sale.create'), createSale);
router.post('/:id/void', requirePermission('sale.void'), voidSale);

export default router;