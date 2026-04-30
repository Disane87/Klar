import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { jwtConfig, mailConfig, appConfig } from './app.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, mailConfig, appConfig],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
