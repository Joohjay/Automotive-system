import { Router } from 'express';

import {
  createCreditPayment,
  createCustomer,
  getCustomer,
  listCustomers,
  setCustomerStatus,
  updateCustomer,
} from '../controllers/customer.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('customer.view'), listCustomers);
router.get('/:id', requirePermission('customer.view'), getCustomer);
router.post('/', requirePermission('customer.manage'), createCustomer);
router.patch('/:id', requirePermission('customer.manage'), updateCustomer);
router.patch('/:id/status', requirePermission('customer.manage'), setCustomerStatus);
router.post('/:id/payments', requirePermission('credit.payment'), createCreditPayment);

export default router;