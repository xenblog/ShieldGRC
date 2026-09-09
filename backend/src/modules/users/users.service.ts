import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private commonInclude() {
    return { orgUnits: { include: { orgUnit: true } } };
  }

  private toAdminUser(user: {
    id: string;
    email: string;
    name: string;
    role: string | null;
    status: string;
    source: string;
    lastLoginAt: Date | null;
    orgUnits: { orgUnit: unknown }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      source: user.source,
      lastLoginAt: user.lastLoginAt,
      orgUnits: user.orgUnits.map((m) => m.orgUnit),
    };
  }

  // Users is the single source of truth for RBAC and org-unit scoping
  // everywhere else in the app - other modules read from it rather than
  // re-deriving or duplicating this list.
  async findAll(query: QueryUsersDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      orgUnits: query.orgUnitId ? { some: { orgUnitId: query.orgUnitId } } : undefined,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const users = await this.prisma.user.findMany({
      where,
      include: this.commonInclude(),
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.toAdminUser(u));
  }

  /** Lightweight list for owner/lead-assessor picker dropdowns - any authenticated user can read this. */
  async findAssignable() {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : null;
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          role: dto.role,
          passwordHash,
          // Admin-created-ahead-of-time account: Invited until the person
          // first signs in (local password today; SSO once linked by email).
          status: 'INVITED',
          source: 'MANUAL',
          orgUnits: dto.orgUnitIds
            ? { create: dto.orgUnitIds.map((orgUnitId) => ({ orgUnitId })) }
            : undefined,
        },
        include: this.commonInclude(),
      });
      await this.audit.record(tx, {
        entityType: 'User',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: actor.id,
        after: created,
      });
      return created;
    });
    return this.toAdminUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    // An SSO account's email must keep matching its Entra UPN - letting it
    // drift here would silently break that user's next SSO login lookup.
    if (dto.email && dto.email.toLowerCase() !== existing.email && existing.source !== 'MANUAL') {
      throw new ForbiddenException('Email cannot be changed for an Entra SSO-provisioned account');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.orgUnitIds) {
        await tx.userOrgUnit.deleteMany({ where: { userId: id } });
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email?.toLowerCase(),
          role: dto.role,
          orgUnits: dto.orgUnitIds
            ? { create: dto.orgUnitIds.map((orgUnitId) => ({ orgUnitId })) }
            : undefined,
        },
        include: this.commonInclude(),
      });
      await this.audit.record(tx, {
        entityType: 'User',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: actor.id,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return this.toAdminUser(user);
  }

  // Soft-deactivate: the record, its audit trail, and its historical risk
  // ownership / assessment assignments are all retained untouched - only
  // login and future active-user pickers are affected.
  async deactivate(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: 'DEACTIVATED' },
        include: this.commonInclude(),
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record(this.prisma, {
      entityType: 'User',
      entityId: id,
      action: AuditAction.UPDATE,
      actorId: actor.id,
      before: existing,
      after: user,
    });
    return this.toAdminUser(user);
  }

  async reactivate(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: this.commonInclude(),
    });
    await this.audit.record(this.prisma, {
      entityType: 'User',
      entityId: id,
      action: AuditAction.UPDATE,
      actorId: actor.id,
      before: existing,
      after: user,
    });
    return this.toAdminUser(user);
  }
}
