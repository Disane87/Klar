import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { UsersModule } from '../users/users.module';
import { HouseholdsModule } from '../households/households.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OidcModule } from '../oidc/oidc.module';
import { CategoriesModule } from '../categories/categories.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { EmailVerificationRepository } from './repositories/email-verification.repository';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKeyPath = config.get<string>('jwt.privateKeyPath');
        const publicKeyPath = config.get<string>('jwt.publicKeyPath');
        const expiresIn = config.get<string>('jwt.accessExpiresIn') ?? '15m';

        if (!privateKeyPath || !publicKeyPath) {
          throw new Error('jwt.privateKeyPath and jwt.publicKeyPath must be configured');
        }

        return {
          privateKey: fs.readFileSync(privateKeyPath),
          publicKey: fs.readFileSync(publicKeyPath),
          signOptions: {
            algorithm: 'RS256',
            // expiresIn type is StringValue — cast required since config returns plain string
            expiresIn: expiresIn as unknown as number,
          },
        };
      },
    }),
    UsersModule,
    HouseholdsModule,
    AuditModule,
    MailModule,
    PrismaModule,
    OidcModule,
    CategoriesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LocalAuthGuard,
    JwtAuthGuard,
    RefreshTokenRepository,
    EmailVerificationRepository,
  ],
  exports: [JwtAuthGuard, LocalAuthGuard],
})
export class AuthModule {}
