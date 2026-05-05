import { describe, it, expect, beforeAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('returns status "ok"', () => {
    expect(controller.check().status).toBe('ok');
  });

  it('returns a valid ISO 8601 timestamp', () => {
    const { timestamp } = controller.check();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('returns a version string', () => {
    expect(typeof controller.check().version).toBe('string');
  });
});
