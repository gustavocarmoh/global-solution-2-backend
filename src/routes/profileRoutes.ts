import { Router } from 'express';
import { body } from 'express-validator';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.get('/me', getProfile);

router.put(
  '/me',
  [
    body('name').optional().isString(),
    body('role').optional().isString(),
    body('age').optional().isInt(),
    body('availability').optional().isObject(),
    body('profilePhoto').optional().isString()
  ],
  handleValidationErrors,
  updateProfile
);

export default router;
