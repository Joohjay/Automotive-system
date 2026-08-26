import { Router } from 'express';

import { config } from '../config/env.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
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
import usersRouter from './users.js';
import branchesRouter from './branches.js';

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
router.use('/users', usersRouter);
router.use('/branches', branchesRouter);

// Heavy-write routes: POST/PUT/PATCH/DELETE get write limiter (60/min)
const writeRoutes = ['/sales', '/returns', '/loans', '/purchases', '/inventory', '/expenses'];
for (const route of writeRoutes) {
  router.use(route, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      writeLimiter(req, res, next);
    } else {
      readLimiter(req, res, next);
    }
  });
}

// Read-heavy routes: GET-only with generous limit
const readRoutes = ['/products', '/customers', '/suppliers', '/reference'];
for (const route of readRoutes) {
  router.use(route, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      writeLimiter(req, res, next);
    } else {
      readLimiter(req, res, next);
    }
  });
}

if (config.isDevelopment) {
  const devRouter = (await import('./dev.js')).default;
  router.use('/_dev', devRouter);
}

export default router;