import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { mfaStatus, mfaSetup, mfaEnable, mfaDisable, mfaLogin } from '../controllers/mfa.controller.js';

const router = Router();

router.get('/status', requireAuth(), mfaStatus);
router.post('/setup', requireAuth(), mfaSetup);
router.post('/enable', requireAuth(), mfaEnable);
router.post('/disable', requireAuth(), mfaDisable);
// mfaLogin does NOT require auth — user authenticates via the temporary MFA cookie
router.post('/verify', mfaLogin);

export default router;
