import { getDb } from '../db/client.js';
import { auditLogs, notifications } from '../db/schema.js';

export interface AuditInput {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(input: AuditInput): Promise<void> {
  const db = await getDb();
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    organizationId: input.organizationId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function createNotification(input: {
  userId: string;
  category: string;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<void> {
  const db = await getDb();
  await db.insert(notifications).values({
    userId: input.userId,
    category: input.category,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl ?? null,
  });
}
