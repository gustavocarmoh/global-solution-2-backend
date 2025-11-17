import { Router } from 'express';
import { body } from 'express-validator';
import { login, register } from '../controllers/authController.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('E-mail invalido.'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve conter ao menos 6 caracteres.'),
    body('name').notEmpty().withMessage('Nome e obrigatorio.')
  ],
  handleValidationErrors,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  handleValidationErrors,
  login
);

export default router;
