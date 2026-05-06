import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig, mailConfig, appConfig, oidcConfig, oauthConfig } from './app.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, mailConfig, appConfig, oidcConfig, oauthConfig],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
