import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { HouseholdOwnerGuard } from '../common/guards/household-owner.guard';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [CategoriesRepository, CategoriesService, HouseholdOwnerGuard],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
