import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { OAuthError } from './oauth-error';

/**
 * Controller-scoped filter, der `OAuthError` in das RFC-6749-konforme Format
 * `{ error, error_description }` transportiert. Er wird via `@UseFilters` an
 * den `OAuthController` gehängt — andere Controller bleiben beim
 * GlobalExceptionFilter (RFC 7807 Problem Details).
 */
@Catch(OAuthError)
export class OAuthExceptionFilter implements ExceptionFilter {
  catch(exception: OAuthError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    reply
      .code(exception.getStatus())
      .header('Content-Type', 'application/json')
      .header('Cache-Control', 'no-store')
      .header('Pragma', 'no-cache')
      .send(exception.toBody());
  }
}
