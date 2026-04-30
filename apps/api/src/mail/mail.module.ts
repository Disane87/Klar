import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { mailConfig, appConfig } from '../config/app.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(mailConfig),
    ConfigModule.forFeature(appConfig),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
