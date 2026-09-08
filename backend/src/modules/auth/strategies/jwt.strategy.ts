import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Runs on every authenticated request. Org unit membership is loaded fresh
  // from the DB (not cached in the JWT) so an Admin's membership change
  // takes effect immediately rather than after the access token expires.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { orgUnits: { select: { orgUnitId: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgUnitIds: user.orgUnits.map((m) => m.orgUnitId),
    };
  }
}
