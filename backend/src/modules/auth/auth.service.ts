import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  orgUnitIds: string[];
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokensForUser(user: User): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTtlMs = this.parseTtlMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d');
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken, refreshTokenExpiresAt: expiresAt };
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status === 'DEACTIVATED') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: revoke the used token and issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokensForUser(user);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Looks up the owning user of a still-valid refresh token, without
  // consuming/revoking it. Used by logout to determine whether an
  // Entra ID end-session redirect is needed, before the token is revoked.
  async findUserByRefreshToken(rawRefreshToken: string): Promise<User | null> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) return null;
    return this.prisma.user.findUnique({ where: { id: stored.userId } });
  }

  // Called only on a real login (local password or Entra callback), never
  // on /auth/refresh, so lastLoginAt reflects actual sign-ins. A successful
  // login always means the account is now in use, so this also carries an
  // Invited account into Active on its first sign-in (the provider-level
  // checks already rejected Deactivated accounts before this runs).
  async recordLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), status: 'ACTIVE' },
    });
  }

  async getUserOrThrow(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async loadPublicUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { orgUnits: { select: { orgUnitId: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgUnitIds: user.orgUnits.map((m) => m.orgUnitId),
    };
  }

  toPublicUser(user: User, orgUnitIds: string[]): PublicUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role, orgUnitIds };
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
    return value * unitMs;
  }
}
