import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { getDb } from './db/client.js';
import { openApiSpec } from './docs/openapi.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { analysisRouter } from './modules/analysis/analysis.routes.js';
import { assetsRouter } from './modules/assets/assets.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dealsRouter } from './modules/deals/deals.routes.js';
import { marketplaceRouter } from './modules/marketplace/marketplace.routes.js';
import { orgRouter } from './modules/organizations/org.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';
import { verificationRouter } from './modules/verification/verification.routes.js';
import { errorMiddleware } from './utils/errors.js';

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error('CORS origin not allowed'));
        }
      },
      credentials: true,
    }),
  );

  app.use(cookieParser());

  // CSRF Origin enforcement for cookie-authenticated state-changing requests
  app.use((req, res, next) => {
    const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isWebhook = req.path === '/api/v1/payments/webhooks/razorpay';
    const usesCookieSession =
      !req.headers.authorization &&
      Boolean(req.cookies?.sl_access_token || req.cookies?.sl_refresh_token);

    if (unsafeMethod && !isWebhook && usesCookieSession) {
      const origin = req.get('origin');
      if (origin && !allowedOrigins.includes(origin)) {
        res.status(403).json({
          error: { code: 'CSRF_ORIGIN_REJECTED', message: 'Untrusted request origin' },
        });
        return;
      }
    }
    next();
  });

  // Preserve raw JSON body on Razorpay webhook for exact HMAC signature check
  app.use(
    '/api/v1/payments/webhooks/razorpay',
    express.text({ type: 'application/json', limit: '1mb' }),
  );
  app.use(express.json({ limit: '2mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(
      '/api/v1/auth',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
    app.use(
      '/api/v1',
      rateLimit({
        windowMs: 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
  }

  app.get('/health', async (_req, res) => {
    try {
      const db = await getDb();
      await db.execute('SELECT 1');
      res.json({ status: 'ok', service: 'secondlife-api', database: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'degraded', error: (err as Error).message });
    }
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/v1/openapi.json', (_req, res) => res.json(openApiSpec));

  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/', orgRouter);
  apiV1.use('/', assetsRouter);
  apiV1.use('/', verificationRouter);
  apiV1.use('/', analysisRouter);
  apiV1.use('/', marketplaceRouter);
  apiV1.use('/', dealsRouter);
  apiV1.use('/', transactionsRouter);
  apiV1.use('/', adminRouter);

  app.use('/api/v1', apiV1);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
  });

  app.use(errorMiddleware);
  return app;
}
