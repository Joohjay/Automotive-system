import { Router } from 'express';

import {
  salesReport,
  inventoryReport,
  expenseReport,
  profitLoss,
} from '../controllers/report.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/sales',     requirePermission('report.view'), salesReport);
router.get('/inventory', requirePermission('report.view'), inventoryReport);
router.get('/expenses',  requirePermission('report.view'), expenseReport);
router.get('/pnl',       requirePermission('report.view'), profitLoss);

export default router;
