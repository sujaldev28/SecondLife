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

  if (env.TRUST_PROXY || process.env.VERCEL === '1' || process.env.RENDER === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = Array.from(
    new Set(
      [
        ...env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
        env.APP_URL,
        process.env.RENDER_EXTERNAL_URL?.trim() ?? '',
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
        process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : '',
      ].filter(Boolean),
    ),
  );

  const isTrustedRequestOrigin = (req: express.Request, origin: string | undefined): boolean => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    try {
      const originHost = new URL(origin).host;
      const requestHost = req.get('x-forwarded-host') || req.get('host');
      return Boolean(requestHost && originHost === requestHost);
    } catch {
      return false;
    }
  };

  app.use(
    cors((req, cb) => {
      const origin = req.header('origin');
      if (isTrustedRequestOrigin(req as express.Request, origin)) {
        cb(null, { origin: true, credentials: true });
      } else {
        cb(new Error('CORS origin not allowed'));
      }
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
      if (origin && !isTrustedRequestOrigin(req, origin)) {
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

  const healthHandler: express.RequestHandler = async (_req, res) => {
    try {
      const db = await getDb();
      await db.execute('SELECT 1');
      res.json({ status: 'ok', service: 'secondlife-api', database: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'degraded', error: (err as Error).message });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
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
