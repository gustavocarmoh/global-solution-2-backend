import { Router } from 'express';
import { body, param } from 'express-validator';
import { cancelBooking, createBooking, listBookings, updateBooking } from '../controllers/bookingController.js';
import { authenticate } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('room').notEmpty(),
    body('meetingDate').isISO8601().withMessage('meetingDate deve estar em YYYY-MM-DD.'),
    body('startTime').matches(/^\d{2}:\d{2}$/),
    body('endTime').matches(/^\d{2}:\d{2}$/),
    body('description').optional().isString()
  ],
  handleValidationErrors,
  createBooking
);

router.get('/', listBookings);

router.patch(
  '/:bookingId',
  [
    param('bookingId').isUUID().withMessage('bookingId invalido.'),
    body('meetingDate').optional().isISO8601(),
    body('startTime').optional().matches(/^\d{2}:\d{2}$/),
    body('endTime').optional().matches(/^\d{2}:\d{2}$/),
    body('room').optional().isString(),
    body('description').optional().isString()
  ],
  handleValidationErrors,
  updateBooking
);

router.patch(
  '/:bookingId/cancel',
  [param('bookingId').isUUID()],
  handleValidationErrors,
  cancelBooking
);

export default router;
