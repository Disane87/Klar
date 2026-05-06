import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * OAuth 2.1 error codes per RFC 6749 §5.2 / RFC 7591 §3.2.2.
 * Wir verwenden NICHT den GlobalExceptionFilter (Problem Details JSON),
 * sondern einen dedizierten Filter, der das Format `{ error, error_description }`
 * emittiert.
 */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error'
  | 'temporarily_unavailable'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'invalid_token';

export interface OAuthErrorBody {
  error: OAuthErrorCode;
  error_description?: string;
  error_uri?: string;
}

export class OAuthError extends HttpException {
  constructor(
    public readonly code: OAuthErrorCode,
    description?: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    const body: OAuthErrorBody = { error: code };
    if (description) body.error_description = description;
    super(body, status);
  }

  toBody(): OAuthErrorBody {
    return this.getResponse() as OAuthErrorBody;
  }
}
