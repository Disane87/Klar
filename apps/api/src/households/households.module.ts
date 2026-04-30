import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HouseholdsRepository } from './households.repository';
import { InviteCodeRepository } from './invite-code.repository';
import { HouseholdsService } from './households.service';
import { HouseholdsController } from './households.controller';
import { HouseholdMemberGuard } from './guards/household-member.guard';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [HouseholdsService, HouseholdsRepository, InviteCodeRepository, HouseholdMemberGuard],
  controllers: [HouseholdsController],
  exports: [HouseholdsService, HouseholdsRepository],
})
export class HouseholdsModule {}
