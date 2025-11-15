import winston from 'winston';
import { serverConfig, logConfig } from './env';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaString = '';
    if (Object.keys(meta).length > 0) {
      metaString = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

// Create transports based on environment
const transports: winston.transport[] = [];

// Console transport for all environments
if (serverConfig.nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
    })
  );
}

// File transports for production
if (serverConfig.nodeEnv === 'production') {
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: logConfig.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Add stream for Morgan HTTP logger integration
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
