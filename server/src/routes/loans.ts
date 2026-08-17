import { Router } from 'express';

import {
  listLoans,
  getLoan,
  createLoan,
  updateLoan,
  closeLoan,
  generateSchedule,
  recordLoanPayment,
  loanSummary,
} from '../controllers/loan.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/summary',            requirePermission('loan.view'), loanSummary);
router.get('/',                   requirePermission('loan.view'), listLoans);
router.get('/:id',                requirePermission('loan.view'), getLoan);
router.post('/',                  requirePermission('loan.manage'), createLoan);
router.patch('/:id',              requirePermission('loan.manage'), updateLoan);
router.post('/:id/close',         requirePermission('loan.manage'), closeLoan);
router.post('/:id/schedule',      requirePermission('loan.manage'), generateSchedule);
router.post('/:id/payments',      requirePermission('loan.manage'), recordLoanPayment);

export default router;
