import { Router } from 'express';
import { body } from 'express-validator';
import { listSupportMessages, sendAiMessage, sendSupportMessage } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.post(
  '/support',
  [body('message').notEmpty()],
  handleValidationErrors,
  sendSupportMessage
);

router.get('/support', listSupportMessages);

router.post(
  '/ai',
  [body('message').notEmpty()],
  handleValidationErrors,
  sendAiMessage
);

export default router;
