import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditEntryInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Normalizes an arbitrary snapshot (typically a Prisma model instance, which
 * may contain Date objects) into a plain JSON-safe value before it goes into
 * a Json column - a round trip through JSON.stringify/parse rather than a
 * bare type cast, so a Date (or anything else with a toJSON) always becomes
 * the same plain value Prisma would end up storing anyway.
 */
function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Writes immutable audit log rows. Entries are never updated or deleted by
 * the app (no update/delete method is exposed anywhere in this service or in
 * AuditLogController) - see ARCHITECTURE.md for the production hardening
 * note about also revoking UPDATE/DELETE at the DB role level.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an audit entry using the given Prisma client/transaction handle,
   * so the write commits atomically with the entity change it describes.
   */
  async record(
    tx: Prisma.TransactionClient | PrismaService,
    input: RecordAuditEntryInput,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        beforeData: toJsonInput(input.before),
        afterData: toJsonInput(input.after),
      },
    });
  }

  async findAll(params: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: params.entityType,
      entityId: params.entityId,
      actorId: params.actorId,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }

  async findForEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }
}
