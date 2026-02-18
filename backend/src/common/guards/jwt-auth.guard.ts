import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guard that requires a valid JWT token in the Authorization header. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
