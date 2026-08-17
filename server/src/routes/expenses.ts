import { Router } from 'express';

import {
  listExpenses,
  getExpense,
  createExpense,
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  expenseSummary,
} from '../controllers/expense.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/categories',   requirePermission('expense.view'), listExpenseCategories);
router.post('/categories',  requirePermission('expense.create'), createExpenseCategory);
router.patch('/categories/:id', requirePermission('expense.create'), updateExpenseCategory);

router.get('/summary',      requirePermission('expense.view'), expenseSummary);
router.get('/',             requirePermission('expense.view'), listExpenses);
router.get('/:id',          requirePermission('expense.view'), getExpense);
router.post('/',            requirePermission('expense.create'), createExpense);

export default router;
