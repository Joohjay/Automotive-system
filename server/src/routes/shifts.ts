import { Router } from 'express';

import {
  listShifts,
  getShift,
  openShift,
  closeShift,
  shiftSummary,
} from '../controllers/shift.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/summary',      requirePermission('shift.open'), shiftSummary);
router.get('/',             requirePermission('shift.open'), listShifts);
router.get('/:id',          requirePermission('shift.open'), getShift);
router.post('/open',        requirePermission('shift.open'), openShift);
router.post('/:id/close',   requirePermission('shift.close'), closeShift);

export default router;
