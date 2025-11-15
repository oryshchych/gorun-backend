import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from '../types/errors';

export enum ValidationType {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params'
}

export function validate(
  schema: z.ZodSchema,
  type: ValidationType = ValidationType.BODY
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[type];
      const validated = await schema.parseAsync(dataToValidate);
      req[type] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });
        
        next(new ValidationError(errors));
      } else {
        next(error);
      }
    }
  };
}
