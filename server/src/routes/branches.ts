import { Router } from 'express';

import {
  activateBranch,
  createBranch,
  deactivateBranch,
  getBranch,
  listBranches,
  updateBranch,
} from '../controllers/branch.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('branch.view'), listBranches);
router.get('/:id', requirePermission('branch.view'), getBranch);
router.post('/', requirePermission('branch.create'), createBranch);
router.patch('/:id', requirePermission('branch.edit'), updateBranch);
router.post('/:id/activate', requirePermission('branch.edit'), activateBranch);
router.post('/:id/deactivate', requirePermission('branch.edit'), deactivateBranch);

export default router;
