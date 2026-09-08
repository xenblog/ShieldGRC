import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CredentialsAuthProvider } from './auth-provider.interface';

/**
 * Email + password login against User.passwordHash. Intended for the seeded
 * local admin account and any other locally-provisioned accounts (dev/test,
 * or a break-glass account if Entra ID is unavailable). Users with no
 * passwordHash (SSO-only) cannot log in through this provider.
 */
@Injectable()
export class LocalAuthProvider implements CredentialsAuthProvider {
  readonly providerKey = 'local';

  constructor(private readonly prisma: PrismaService) {}

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }
}
