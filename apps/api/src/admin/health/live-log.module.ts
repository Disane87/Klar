import { Global, Module } from '@nestjs/common';
import { LiveLogBuffer } from './live-log.buffer';

/**
 * Global module that exposes the singleton {@link LiveLogBuffer}. Marked
 * `@Global` so the pino logger config in `AppModule` and the admin endpoints
 * in `AdminHealthModule` can share the exact same instance without explicit
 * cross-module wiring.
 */
@Global()
@Module({
  providers: [LiveLogBuffer],
  exports: [LiveLogBuffer],
})
export class LiveLogModule {}
