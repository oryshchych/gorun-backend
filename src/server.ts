import app from './app';
import { connectDatabase } from './config/database';
import { serverConfig } from './config/env';
import { logger } from './config/logger';

/**
 * Start the Express server
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('Database connection established');

    // Start Express server on configured PORT
    const server = app.listen(serverConfig.port, () => {
      logger.info(`Server running in ${serverConfig.nodeEnv} mode on port ${serverConfig.port}`);
      logger.info(`Health check available at http://localhost:${serverConfig.port}/api/health`);
    });

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Close database connection
          await require('./config/database').disconnectDatabase();
          logger.info('Database connection closed');
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Rejection:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
