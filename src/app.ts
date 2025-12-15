import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsConfig } from './config/env';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import authRoutes from './routes/auth.routes';
import eventsRoutes from './routes/events.routes';
import registrationsRoutes from './routes/registrations.routes';
import promoCodeRoutes from './routes/promoCodes.routes';
import webhooksRoutes from './routes/webhooks.routes';

/**
 * Request logging middleware
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 400) {
      logger.warn(logMessage, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      });
    } else {
      logger.info(logMessage, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      });
    }
  });

  next();
};

/**
 * Create and configure Express application
 */
const createApp = (): Application => {
  const app = express();

  // Apply CORS middleware with configured origin
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // non-browser clients
        cb(null, corsConfig.origin.has(origin));
      },
      credentials: true,
    })
  );

  // Apply Helmet middleware for security headers
  app.use(helmet());

  // Apply JSON body parser
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: string }).rawBody = buf.toString();
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Apply request logging middleware
  app.use(requestLogger);

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount Swagger UI at /api-docs endpoint
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Events Platform API Documentation',
    })
  );

  // Apply rate limiters and mount routes
  // Auth routes with stricter rate limiting
  app.use('/api/auth', authLimiter, authRoutes);

  // Events routes with general API rate limiting
  app.use('/api/events', apiLimiter, eventsRoutes);

  // Registrations routes with general API rate limiting
  app.use('/api/registrations', apiLimiter, registrationsRoutes);

  // Promo code validation
  app.use('/api/promo-codes', apiLimiter, promoCodeRoutes);

  // Webhooks (no rate limit)
  app.use('/api/webhooks', webhooksRoutes);

  // Apply 404 handler middleware for undefined routes
  app.use(notFoundHandler);

  // Apply global error handler middleware (must be last)
  app.use(errorHandler);

  return app;
};

// Export app instance
export default createApp();
