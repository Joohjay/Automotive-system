import { Router } from 'express';

import { createReturn, getReturn, listReturns } from '../controllers/return.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('sale.return'), listReturns);
router.get('/:id', requirePermission('sale.return'), getReturn);
router.post('/', requirePermission('sale.return'), createReturn);

export default router;