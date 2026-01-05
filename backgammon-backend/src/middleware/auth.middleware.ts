import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { AuthenticationError } from '../errors/AppError';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    next(new AuthenticationError('Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = verifyAccessToken(token);
      req.user = { userId: decoded.userId, email: decoded.email };
    } catch {
      // Token invalid, but that's okay for optional auth
    }
  }

  next();
}
