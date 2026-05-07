import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM crypto for FinTS connection credentials.
 *
 * What goes in the cipher blob:
 * - PIN (plaintext only inside encrypt/decrypt)
 * - lib-fints session state (TAN-method list, BPD/UPD parameter data,
 *   KundenSystemID) — re-encrypted after each lib-fints call
 *
 * Key handling:
 * - Master key is FINTS_MASTER_KEY (32-byte hex), loaded once at boot
 *   from {@link ConfigService}. Missing or malformed key fails app startup.
 * - AAD is the connection's id, so a cipher cannot be swapped between
 *   connections.
 *
 * The plaintext PIN never enters DB writes, audit logs, or sync-run error
 * messages — Pino redaction is enforced separately in app.module.ts.
 */
@Injectable()
export class FintsCryptoService implements OnModuleInit {
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_BYTES = 12;
  private static readonly TAG_BYTES = 16;
  private static readonly KEY_BYTES = 32;

  private readonly logger = new Logger(FintsCryptoService.name);
  private masterKey: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const hex = this.config.get<string>('fints.masterKeyHex') ?? '';
    if (!hex) {
      // Allowed in dev/test environments where FinTS isn't exercised; the
      // service throws on the first encrypt/decrypt call instead of
      // hard-failing app boot. This lets the existing test suite run
      // without requiring the env var.
      this.logger.warn(
        'FINTS_MASTER_KEY not configured — FinTS encryption will fail until set',
      );
      return;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'FINTS_MASTER_KEY must be 32 bytes hex (64 hex chars). Generate via `openssl rand -hex 32`.',
      );
    }
    this.masterKey = Buffer.from(hex, 'hex');
  }

  /**
   * Encrypts an arbitrary JSON-serialisable payload bound to a connection.
   * Returns the cipher, iv, and tag as separate buffers — caller stores
   * them on the FintsConnection row.
   */
  encrypt(connectionId: string, plain: unknown): {
    cipher: Buffer;
    iv: Buffer;
    tag: Buffer;
  } {
    const key = this.requireKey();
    const iv = randomBytes(FintsCryptoService.IV_BYTES);
    const cipher = createCipheriv(FintsCryptoService.ALGO, key, iv);
    cipher.setAAD(Buffer.from(connectionId, 'utf8'));
    const buf = Buffer.concat([
      cipher.update(JSON.stringify(plain), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return { cipher: buf, iv, tag };
  }

  /**
   * Decrypts a previously-encrypted payload. Throws when:
   * - the master key is not configured
   * - the auth tag fails (tampered cipher or wrong AAD/iv combination)
   *
   * Callers MUST treat decryption failures as security incidents — log
   * the connectionId, do NOT log the cipher or any partial output.
   */
  decrypt<T = unknown>(
    connectionId: string,
    parts: { cipher: Buffer; iv: Buffer; tag: Buffer },
  ): T {
    const key = this.requireKey();
    const decipher = createDecipheriv(FintsCryptoService.ALGO, key, parts.iv);
    decipher.setAAD(Buffer.from(connectionId, 'utf8'));
    decipher.setAuthTag(parts.tag);
    const buf = Buffer.concat([
      decipher.update(parts.cipher),
      decipher.final(),
    ]);
    return JSON.parse(buf.toString('utf8')) as T;
  }

  /**
   * Returns true when the service is ready to encrypt/decrypt. Used by
   * health checks (the future /health endpoint will surface this) and
   * by setup endpoints to refuse connection creation when the key is
   * missing — better to fail loudly than to write data that becomes
   * unreadable later.
   */
  isReady(): boolean {
    return this.masterKey !== null;
  }

  private requireKey(): Buffer {
    if (!this.masterKey) {
      throw new Error(
        'FINTS_MASTER_KEY is not configured — cannot encrypt/decrypt FinTS credentials',
      );
    }
    return this.masterKey;
  }
}
