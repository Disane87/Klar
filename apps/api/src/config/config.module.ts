import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig, mailConfig, appConfig, oidcConfig } from './app.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, mailConfig, appConfig, oidcConfig],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
