import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function errorMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void {
  // Log error for debugging (in production, use proper logger)
  console.error(`[ERROR] ${req.method} ${req.path}:`, error.message);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details }),
    });
    return;
  }

  // Don't expose internal error details in production
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
