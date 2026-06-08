import { logger } from '../config/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  AuditLog,
  AuditAction,
  AuditActorRole,
  AuditChange,
  AuditEntity,
} from '../models/AuditLog';
import { User } from '../models/User';

const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt', '__v']);

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): AuditChange[] {
  const changes: AuditChange[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const bVal = before[key];
    const aVal = after[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes.push({ field: key, before: bVal, after: aVal });
    }
  }

  return changes;
}

function resolveActorRole(user: AuthRequest['user']): AuditActorRole {
  if (!user) return 'user';
  if (user.adminRole === 'super_admin') return 'super_admin';
  if (user.isAdmin) return 'admin';
  return 'user';
}

export interface WriteAuditLogParams {
  req: AuthRequest;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    const { req, action, entity, entityId, entityLabel, before, after } = params;

    let actorName = 'Unknown';
    let actorEmail = 'unknown@unknown';

    if (req.user?.userId) {
      const actor = await User.findById(req.user.userId).select('name email').lean();
      if (actor) {
        actorName = actor.name || actorEmail;
        actorEmail = actor.email;
      }
    }

    const changes: AuditChange[] = before && after ? diffObjects(before, after) : [];

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      undefined;

    const userAgent = req.headers['user-agent'] ?? undefined;

    await AuditLog.create({
      actorId: req.user?.userId ?? undefined,
      actorName,
      actorEmail,
      actorRole: resolveActorRole(req.user),
      action,
      entity,
      entityId,
      entityLabel,
      changes,
      ip,
      userAgent,
    });
  } catch (err) {
    logger.error('Failed to write audit log', {
      err,
      params: { action: params.action, entity: params.entity, entityId: params.entityId },
    });
  }
}
