import { Router } from 'express';

import {
  activateUser,
  adminResetPassword,
  assignBranch,
  assignRole,
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('user.view'), listUsers);
router.get('/:id', requirePermission('user.view'), getUser);
router.post('/', requirePermission('user.create'), createUser);
router.patch('/:id', requirePermission('user.edit'), updateUser);
router.post('/:id/activate', requirePermission('user.edit'), activateUser);
router.post('/:id/deactivate', requirePermission('user.edit'), deactivateUser);
router.patch('/:id/role', requirePermission('user.edit'), assignRole);
router.patch('/:id/branch', requirePermission('user.edit'), assignBranch);
router.post('/:id/password-reset', requirePermission('user.edit'), adminResetPassword);

export default router;
