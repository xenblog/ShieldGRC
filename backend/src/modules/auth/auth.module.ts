import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { EntraAuthProvider } from './providers/entra-auth.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, LocalAuthProvider, EntraAuthProvider, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
