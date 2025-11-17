import { Router } from 'express';
import { releaseExpiredBookings } from '../controllers/automationController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/release-expired', authenticate, releaseExpiredBookings);

export default router;
