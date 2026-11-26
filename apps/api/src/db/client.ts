import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { env } from '../config/env.js';

export type Database = ReturnType<typeof drizzlePg<typeof schema>>;

let dbInstance: Database | null = null;
let pgliteClient: PGlite | null = null;
let pgPool: pg.Pool | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL.startsWith('pglite://') || env.DATABASE_URL === 'memory://') {
    const rawTarget = env.DATABASE_URL === 'memory://' ? undefined : env.DATABASE_URL.replace('pglite://', '');
    if (rawTarget) {
      const absDir = path.resolve(process.cwd(), rawTarget);
      fs.mkdirSync(absDir, { recursive: true });
      pgliteClient = new PGlite(absDir);
    } else {
      pgliteClient = new PGlite();
    }
    await pgliteClient.waitReady;
    dbInstance = drizzlePglite(pgliteClient, { schema }) as unknown as Database;
    return dbInstance;
  }

  pgPool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30_000,
  });
  dbInstance = drizzlePg(pgPool, { schema });
  return dbInstance;
}

export async function executeRawSql(sqlText: string): Promise<void> {
  await getDb();
  if (pgliteClient) {
    await pgliteClient.exec(sqlText);
    return;
  }
  if (pgPool) {
    await pgPool.query(sqlText);
  }
}

export async function closeDb(): Promise<void> {
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = null;
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  dbInstance = null;
}

export function resetDbForTesting(customDb: Database, customPglite?: PGlite): void {
  dbInstance = customDb;
  pgliteClient = customPglite ?? null;
}
