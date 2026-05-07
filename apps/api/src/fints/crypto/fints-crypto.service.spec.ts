import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { FintsCryptoService } from './fints-crypto.service';

const TEST_KEY_HEX = '0'.repeat(64); // deterministic, test-only

function buildService(keyHex = TEST_KEY_HEX): FintsCryptoService {
  const config = {
    get: (k: string) => (k === 'fints.masterKeyHex' ? keyHex : undefined),
  } as unknown as ConfigService;
  const service = new FintsCryptoService(config);
  service.onModuleInit();
  return service;
}

describe('FintsCryptoService', () => {
  let service: FintsCryptoService;

  beforeAll(() => {
    service = buildService();
  });

  it('round-trip preserves the payload', () => {
    const payload = { pin: 'secret', state: { tanMethods: ['pushTAN'] } };
    const parts = service.encrypt('conn-1', payload);
    const decrypted = service.decrypt('conn-1', parts);
    expect(decrypted).toEqual(payload);
  });

  it('produces different ciphers for the same payload (random IV)', () => {
    const a = service.encrypt('conn-1', { pin: 'x' });
    const b = service.encrypt('conn-1', { pin: 'x' });
    expect(a.cipher.equals(b.cipher)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it('rejects decrypt with wrong AAD (different connectionId)', () => {
    const parts = service.encrypt('conn-1', { pin: 'x' });
    expect(() => service.decrypt('conn-2', parts)).toThrow();
  });

  it('rejects decrypt with tampered cipher', () => {
    const parts = service.encrypt('conn-1', { pin: 'x' });
    parts.cipher[0] ^= 0xff;
    expect(() => service.decrypt('conn-1', parts)).toThrow();
  });

  it('rejects decrypt with tampered tag', () => {
    const parts = service.encrypt('conn-1', { pin: 'x' });
    parts.tag[0] ^= 0xff;
    expect(() => service.decrypt('conn-1', parts)).toThrow();
  });

  it('throws when master key is malformed', () => {
    const config = {
      get: () => 'not-hex',
    } as unknown as ConfigService;
    const svc = new FintsCryptoService(config);
    expect(() => svc.onModuleInit()).toThrow(/32 bytes hex/);
  });

  it('throws on encrypt when master key is missing', () => {
    const svc = buildService('');
    expect(svc.isReady()).toBe(false);
    expect(() => svc.encrypt('conn-1', { pin: 'x' })).toThrow(/not configured/);
  });

  it('isReady reflects key presence', () => {
    expect(buildService().isReady()).toBe(true);
    expect(buildService('').isReady()).toBe(false);
  });
});
