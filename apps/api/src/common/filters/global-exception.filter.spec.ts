import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

const mockSend = vi.fn();
const mockCode = vi.fn().mockReturnThis();
const mockHeader = vi.fn().mockReturnThis();

function makeMockHost(url: string): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ code: mockCode, header: mockHeader, send: mockSend }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    vi.clearAllMocks();
  });

  it('maps NotFoundException to RFC 7807 status 404', () => {
    filter.catch(new NotFoundException('User not found'), makeMockHost('/api/v1/users/123'));

    expect(mockCode).toHaveBeenCalledWith(404);
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(mockSend).toHaveBeenCalledWith({
      type: 'https://haushaltsbuch.app/errors/not-found',
      title: 'Ressource nicht gefunden',
      status: 404,
      detail: 'User not found',
      instance: '/api/v1/users/123',
    });
  });

  it('maps BadRequestException to 400', () => {
    filter.catch(new BadRequestException('Invalid input'), makeMockHost('/api/v1/test'));

    expect(mockCode).toHaveBeenCalledWith(400);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        type: 'https://haushaltsbuch.app/errors/bad-request',
      }),
    );
  });

  it('maps unknown errors to 500', () => {
    filter.catch(new Error('Unexpected'), makeMockHost('/api/v1/test'));

    expect(mockCode).toHaveBeenCalledWith(500);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        type: 'https://haushaltsbuch.app/errors/internal-server-error',
      }),
    );
  });

  it('sets Content-Type to application/problem+json for all responses', () => {
    filter.catch(new NotFoundException(), makeMockHost('/'));
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
  });
});
