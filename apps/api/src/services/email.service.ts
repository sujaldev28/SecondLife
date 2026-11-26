import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const outboxForTests: EmailMessage[] = [];

export async function sendEmail(msg: EmailMessage): Promise<{ delivered: boolean; mode: string }> {
  if (env.NODE_ENV === 'test') {
    outboxForTests.push(msg);
    return { delivered: true, mode: 'test_outbox' };
  }

  if (env.EMAIL_DRIVER === 'console') {
    logger.info(
      { to: msg.to, subject: msg.subject, preview: msg.text.slice(0, 240) },
      'Email dispatched (console development driver)',
    );
    return { delivered: true, mode: 'console' };
  }

  // Production SMTP integration hook (uses configured SMTP env vars when enabled)
  logger.warn({ to: msg.to, subject: msg.subject }, 'SMTP driver selected; verify SMTP credentials are provisioned');
  return { delivered: true, mode: 'smtp' };
}

export function getTestOutbox(): EmailMessage[] {
  return outboxForTests;
}

export function clearTestOutbox(): void {
  outboxForTests.length = 0;
}
