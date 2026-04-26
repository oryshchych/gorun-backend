declare global {
  namespace Express {
    interface Request {
      /**
       * Set by validate(..., QUERY) — do not assign to req.query (read-only in Express 5).
       */
      validatedQuery?: unknown;
      /**
       * Set by validate(..., PARAMS) — req.params may be read-only in Express 5.
       */
      validatedParams?: unknown;
    }
  }
}

export {};
