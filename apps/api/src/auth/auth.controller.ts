import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterResponse, AuthUser, RefreshResponse } from '@klar/shared';
import { AuthService, type RegisterInput } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';

interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface ResendBody {
  email: string;
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body() dto: RegisterInput,
    @Req() req: FastifyRequest,
  ): Promise<RegisterResponse> {
    return this.authService.register(dto, {
      ip: req.ip,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() body: LoginBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const validatedUser = await this.authService.validateLocalUser(body.email, body.password);
    const { accessToken, user, refreshToken, refreshExpiresIn } =
      await this.authService.login(validatedUser, { rememberMe: body.rememberMe }, {
        ip: req.ip,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });

    void reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: refreshExpiresIn,
    });

    return { accessToken, user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async logout(
    @CurrentUser() payload: JwtPayload,
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const raw = req.cookies?.['refresh_token'];
    if (raw) {
      await this.authService.logout(raw, payload.sub);
    }
    void reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async refresh(
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponse> {
    const raw = req.cookies?.['refresh_token'];
    if (!raw) {
      throw new BadRequestException('Kein Refresh-Token vorhanden');
    }

    const { accessToken, user, refreshToken, refreshExpiresIn } =
      await this.authService.refresh(raw, {
        ip: req.ip,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });

    void reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: refreshExpiresIn,
    });

    return { accessToken, user };
  }

  @Public()
  @Get('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Token fehlt');
    }
    await this.authService.verifyEmail(token);
    return { message: 'E-Mail-Adresse erfolgreich bestätigt.' };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 300000 } })
  async resendVerification(@Body() body: ResendBody): Promise<{ message: string }> {
    await this.authService.resendVerification(body.email);
    return { message: 'Falls eine passende E-Mail-Adresse existiert, wurde eine neue E-Mail gesendet.' };
  }
}
