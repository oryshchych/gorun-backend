import { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { VALIDATION_CODES } from '../types/codes';
import { ValidationError } from '../types/errors';

export type ValidateOptions = { statusCode?: number };

export enum ValidationType {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
}

export function validate(
  schema: z.ZodSchema,
  type: ValidationType = ValidationType.BODY,
  options?: ValidateOptions
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[type];
      const validated = await schema.parseAsync(dataToValidate);

      // Express 5: req.query / req.params are getters — assigning throws TypeError.
      if (type === ValidationType.QUERY) {
        req.validatedQuery = validated;
      } else if (type === ValidationType.PARAMS) {
        req.validatedParams = validated;
      } else {
        req.body = validated;
      }

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

        next(
          new ValidationError(
            errors,
            VALIDATION_CODES.ERROR_VALIDATION_FAILED,
            options?.statusCode ?? 400
          )
        );
      } else {
        next(error);
      }
    }
  };
}
