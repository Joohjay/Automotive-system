import { Router } from 'express';

import healthRouter from './health.js';
import authRouter from './auth.js';
import productRouter from './products.js';
import inventoryRouter from './inventory.js';
import referenceDataRouter from './referenceData.js';
import supplierRouter from './suppliers.js';
import purchaseRouter from './purchases.js';
import customerRouter from './customers.js';
import saleRouter from './sales.js';
import returnRouter from './returns.js';
import expenseRouter from './expenses.js';
import loanRouter from './loans.js';
import shiftRouter from './shifts.js';
import reportRouter from './reports.js';
import notificationRouter from './notifications.js';
import devRouter from './dev.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/products', productRouter);
router.use('/inventory', inventoryRouter);
router.use('/reference', referenceDataRouter);
router.use('/suppliers', supplierRouter);
router.use('/purchases', purchaseRouter);
router.use('/customers', customerRouter);
router.use('/sales', saleRouter);
router.use('/returns', returnRouter);
router.use('/expenses', expenseRouter);
router.use('/loans', loanRouter);
router.use('/shifts', shiftRouter);
router.use('/reports', reportRouter);
router.use('/notifications', notificationRouter);
router.use('/_dev', devRouter);

export default router;