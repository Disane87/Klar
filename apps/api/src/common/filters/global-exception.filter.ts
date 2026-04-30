import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

const STATUS_TITLES: Record<number, string> = {
  400: 'Ungültige Anfrage',
  401: 'Nicht authentifiziert',
  403: 'Zugriff verweigert',
  404: 'Ressource nicht gefunden',
  409: 'Konflikt',
  422: 'Validierungsfehler',
  429: 'Zu viele Anfragen',
  500: 'Interner Serverfehler',
};

const STATUS_SLUGS: Record<number, string> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'unprocessable-entity',
  429: 'too-many-requests',
  500: 'internal-server-error',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Ein unerwarteter Fehler ist aufgetreten.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        detail = res;
      } else {
        const msg = (res as { message?: string | string[] }).message;
        detail = Array.isArray(msg) ? msg.join(', ') : (msg ?? detail);
      }
    } else {
      this.logger.error(exception);
    }

    const body: ProblemDetail = {
      type: `https://haushaltsbuch.app/errors/${STATUS_SLUGS[status] ?? 'error'}`,
      title: STATUS_TITLES[status] ?? 'Fehler',
      status,
      detail,
      instance: request.url,
    };

    reply
      .code(status)
      .header('Content-Type', 'application/problem+json')
      .send(body);
  }
}
