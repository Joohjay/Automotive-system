import { Router } from 'express';

import {
  createAdjustment,
  getSummary,
  listStock,
  listTransactions,
} from '../controllers/inventory.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/summary', getSummary);
router.get('/transactions', listTransactions);
router.get('/stock', listStock);
router.post('/adjustments', requirePermission('inventory.adjust'), createAdjustment);

export default router;