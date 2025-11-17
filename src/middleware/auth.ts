import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  sub: string;
  email: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction): Response | void {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: 'Token nao enviado.' });
  }

  const [, token] = header.split(' ');

  if (!token) {
    return res.status(401).json({ message: 'Formato de autorizacao invalido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? '') as JwtPayload;
    req.user = { id: decoded.sub, email: decoded.email };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido ou expirado.' });
  }
}
