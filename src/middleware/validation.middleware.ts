import { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { ValidationError } from '../types/errors';

export enum ValidationType {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
}

export function validate(schema: z.ZodSchema, type: ValidationType = ValidationType.BODY) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[type];
      const validated = await schema.parseAsync(dataToValidate);
      req[type] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};

        error.issues.forEach(issue => {
          const path = issue.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          // We just ensured errors[path] exists above, so it's safe to access
          const errorArray = errors[path] as string[];
          errorArray.push(issue.message);
        });

        next(new ValidationError(errors));
      } else {
        next(error);
      }
    }
  };
}
