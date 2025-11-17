import { type NextFunction, type Request, type Response } from 'express';
import { validationResult } from 'express-validator';

export function handleValidationErrors(req: Request, res: Response, next: NextFunction): Response | void {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const formatted = errors.array().map((err) => ({
    field: 'path' in err ? err.path : err.type,
    message: err.msg
  }));

  return res.status(400).json({ message: 'Payload invalido.', errors: formatted });
}
