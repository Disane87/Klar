import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationRulesRepository } from './notification-rules.repository';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRulesController } from './notification-rules.controller';
import { RulesEngineService } from './rules-engine.service';
import { InAppDispatcher } from './dispatchers/in-app.dispatcher';

@Module({
  imports: [PrismaModule, HouseholdsModule, NotificationsModule],
  providers: [
    NotificationRulesRepository,
    NotificationRulesService,
    RulesEngineService,
    InAppDispatcher,
  ],
  controllers: [NotificationRulesController],
  exports: [NotificationRulesService, RulesEngineService],
})
export class NotificationRulesModule {}
