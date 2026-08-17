import { Router } from 'express';

import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth());

router.post('/read-all',  markAllAsRead);
router.patch('/:id/read', markAsRead);
router.get('/',           listNotifications);

export default router;
