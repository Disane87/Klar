import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { MailTemplateRepository } from './mail-template.repository';
import { MailTemplateService } from './mail-template.service';
import { MailTemplateController } from './mail-template.controller';

@Module({
  imports: [HouseholdsModule],
  providers: [MailTemplateRepository, MailTemplateService],
  controllers: [MailTemplateController],
  exports: [MailTemplateService],
})
export class MailTemplatesModule {}