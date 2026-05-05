import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { HouseholdsRepository } from './households.repository';
import { InvitationLinkRepository } from './invitation-link.repository';
import { UsersRepository } from '../users/users.repository';
import { HouseholdsService } from './households.service';
import { HouseholdsController } from './households.controller';
import { HouseholdMemberGuard } from './guards/household-member.guard';
import { appConfig } from '../config/app.config';

@Module({
  imports: [PrismaModule, AuditModule, MailModule, ConfigModule.forFeature(appConfig)],
  providers: [HouseholdsService, HouseholdsRepository, InvitationLinkRepository, UsersRepository, HouseholdMemberGuard],
  controllers: [HouseholdsController],
  exports: [HouseholdsService, HouseholdsRepository],
})
export class HouseholdsModule {}
