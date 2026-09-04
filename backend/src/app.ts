/**
 * Express app setup and configuration
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from './utils/logger';
import { errorHandler } from './api/middleware/errorHandler';
import { requestLogger } from './api/middleware/requestLogger';
import jobsRouter from './api/routes/jobs';
import healthRouter from './api/routes/health';

/**
 * Create Express application
 */
export function createApp(): express.Application {
  const app = express();

  // Trust proxy in production
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  }));

  // Compression
  app.use(compression());

  // Logging
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg) } }));

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Request tracking
  app.use(requestLogger);

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // API Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/jobs', jobsRouter);

  // Default route
  app.get('/', (req: Request, res: Response) => {
    res.json({
      message: 'AI Platform API',
      version: '1.0.0',
      endpoints: {
        health: '/api/v1/health',
        jobs: '/api/v1/jobs',
      },
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.path} not found`,
      },
      timestamp: new Date(),
    });
  });

  // Error handler (must be last)
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    errorHandler(error, req, res, next);
  });

  return app;
}
