import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
}
