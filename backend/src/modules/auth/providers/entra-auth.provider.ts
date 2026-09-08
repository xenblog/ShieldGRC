import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@prisma/client';
import { Issuer, Client, generators } from 'openid-client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RedirectAuthProvider } from './auth-provider.interface';

/**
 * OIDC authorization-code login against Entra ID (Azure AD). Kept behind the
 * RedirectAuthProvider interface so it can be swapped for another OIDC/SAML
 * provider, or supplemented later with an invite/magic-link flow for
 * external supplier users, without AuthService needing to change.
 *
 * First-time SSO sign-in provisions a User with no org unit membership and a
 * conservative default role (least privilege) - an Admin must assign org
 * units and, if needed, elevate the role.
 */
@Injectable()
export class EntraAuthProvider implements RedirectAuthProvider {
  readonly providerKey = 'entra';
  private readonly logger = new Logger(EntraAuthProvider.name);
  private client: Client | null = null;
  private clientInitPromise: Promise<Client> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('ENTRA_TENANT_ID') &&
        this.config.get<string>('ENTRA_CLIENT_ID') &&
        this.config.get<string>('ENTRA_CLIENT_SECRET') &&
        this.config.get<string>('ENTRA_REDIRECT_URI'),
    );
  }

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (!this.clientInitPromise) {
      this.clientInitPromise = this.buildClient();
    }
    this.client = await this.clientInitPromise;
    return this.client;
  }

  private async buildClient(): Promise<Client> {
    const tenantId = this.config.getOrThrow<string>('ENTRA_TENANT_ID');
    const clientId = this.config.getOrThrow<string>('ENTRA_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('ENTRA_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('ENTRA_REDIRECT_URI');

    const issuer = await Issuer.discover(
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
    );
    return new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
    });
  }

  generateState(): string {
    return generators.state();
  }

  async getAuthorizationUrl(state: string): Promise<string> {
    const client = await this.getClient();
    return client.authorizationUrl({
      scope: 'openid profile email',
      state,
    });
  }

  async handleCallback(code: string, state: string, expectedState: string): Promise<User> {
    if (!state || state !== expectedState) {
      throw new UnauthorizedException('Invalid SSO state - please try signing in again');
    }
    const client = await this.getClient();
    const redirectUri = this.config.getOrThrow<string>('ENTRA_REDIRECT_URI');

    const tokenSet = await client.callback(redirectUri, { code, state }, { state });
    const claims = tokenSet.claims();

    const azureAdObjectId = claims.oid ?? claims.sub;
    const email = (claims.email as string | undefined)?.toLowerCase() ?? (claims.preferred_username as string | undefined)?.toLowerCase();
    const name = (claims.name as string | undefined) ?? email ?? 'Unknown user';

    if (!azureAdObjectId || !email) {
      throw new UnauthorizedException('Entra ID did not return the required profile claims');
    }

    let user = await this.prisma.user.findUnique({ where: { azureAdObjectId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('This account has been deactivated');
      }
      if (user.azureAdObjectId !== azureAdObjectId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { azureAdObjectId },
        });
      }
      return user;
    }

    const defaultRole = (this.config.get<string>('ENTRA_DEFAULT_ROLE') as UserRole) ?? UserRole.AUDITOR;
    this.logger.log(`Provisioning new SSO user ${email} with default role ${defaultRole}`);
    return this.prisma.user.create({
      data: {
        email,
        name,
        role: defaultRole,
        azureAdObjectId,
      },
    });
  }
}
