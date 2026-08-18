import { Router } from 'express';

import { changePassword, forgotPassword, login, logout, me, resetPassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.get('/me', requireAuth(), me);
router.post('/logout', requireAuth(), logout);
router.post('/change-password', requireAuth(), changePassword);
router.post('/forgot-password', loginLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

export default router;