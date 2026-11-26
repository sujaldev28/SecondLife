import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeRawSql, getDb } from './client.js';
import { logger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  await getDb();
  let migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(__dirname, '../../src/db/migrations');
  }
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at ${migrationsDir}`);
  }

  await executeRawSql(`
    CREATE TABLE IF NOT EXISTS _secondlife_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const db = await getDb();
  const appliedRows = (await db.execute(
    'SELECT filename FROM _secondlife_migrations ORDER BY filename ASC',
  )) as { rows?: Array<{ filename: string }> };
  const applied = new Set((appliedRows.rows ?? []).map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await executeRawSql(stmt);
    }

    await executeRawSql(
      `INSERT INTO _secondlife_migrations (filename) VALUES ('${file.replace(/'/g, "''")}');`,
    );
    logger.info({ migration: file }, 'Applied database migration');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMigrations()
    .then(() => {
      logger.info('All migrations applied successfully');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    });
}
