import express from 'express';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

let initPromise: Promise<void> | null = null;

/**
 * Ensures database migrations and baseline catalog/plan records are applied once
 * per serverless container lifecycle before handling API traffic.
 */
async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations();
      await seedDatabase();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

const app = express();

app.use(async (_req, _res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(createApp());

export default app;
