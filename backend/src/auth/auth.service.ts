import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

/** Handles OIDC token validation and user provisioning. */
@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  /** Find or create a user from OIDC token claims. */
  async validateOidcUser(profile: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<User> {
    let user = await this.usersService.findByOidcSubject(profile.sub);
    if (!user) {
      user = await this.usersService.create({
        oidcSubject: profile.sub,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture || null,
      });
    }
    return user;
  }

  /** Returns the OIDC configuration for the frontend. */
  getOidcConfig() {
    return {
      authority: this.configService.get('OIDC_AUTHORITY', 'http://localhost:8080/realms/denaro'),
      clientId: this.configService.get('OIDC_CLIENT_ID', 'denaro'),
      redirectUri: this.configService.get('OIDC_REDIRECT_URI', 'http://localhost:4200/auth/callback'),
      scope: this.configService.get('OIDC_SCOPE', 'openid profile email'),
    };
  }
}
