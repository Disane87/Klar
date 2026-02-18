import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from './jwks-helper';
import { AuthService } from './auth.service';

/** Validates JWT tokens issued by the OIDC provider. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const authority = configService.get('OIDC_AUTHORITY', 'http://localhost:8080/realms/denaro');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: authority,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${authority}/protocol/openid-connect/certs`,
      }),
    });
  }

  async validate(payload: { sub: string; email: string; name?: string; preferred_username?: string; picture?: string }) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token: missing subject');
    }
    return this.authService.validateOidcUser({
      sub: payload.sub,
      email: payload.email || payload.preferred_username || '',
      name: payload.name || payload.preferred_username || 'User',
      picture: payload.picture,
    });
  }
}
