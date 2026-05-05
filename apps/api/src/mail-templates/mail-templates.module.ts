import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module';
import { MailTemplateRepository } from './mail-template.repository';
import { MailTemplateService } from './mail-template.service';
import { MailTemplateController } from './mail-template.controller';
import { MailTemplateSeederService } from './mail-template-seeder.service';

@Module({
  imports: [HouseholdsModule],
  providers: [MailTemplateRepository, MailTemplateService, MailTemplateSeederService],
  controllers: [MailTemplateController],
  exports: [MailTemplateService],
})
export class MailTemplatesModule {}