import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule, HouseholdsModule],
  providers: [NotificationsRepository, NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
