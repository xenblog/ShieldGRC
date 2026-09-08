import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private commonInclude() {
    return { orgUnits: { include: { orgUnit: true } } };
  }

  private toAdminUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    orgUnits: { orgUnit: unknown }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      orgUnits: user.orgUnits.map((m) => m.orgUnit),
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: this.commonInclude(),
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.toAdminUser(u));
  }

  /** Lightweight list for owner/lead-assessor picker dropdowns - any authenticated user can read this. */
  async findAssignable() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : null;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        role: dto.role,
        passwordHash,
        orgUnits: dto.orgUnitIds
          ? { create: dto.orgUnitIds.map((orgUnitId) => ({ orgUnitId })) }
          : undefined,
      },
      include: this.commonInclude(),
    });
    return this.toAdminUser(user);
  }

  async deactivate(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: this.commonInclude(),
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.toAdminUser(user);
  }
}
