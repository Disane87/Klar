import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationRulesRepository } from './notification-rules.repository';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRulesController } from './notification-rules.controller';
import { RulesEngineService } from './rules-engine.service';
import { InAppDispatcher } from './dispatchers/in-app.dispatcher';
import { WebPushDispatcher } from './dispatchers/web-push.dispatcher';
import { PushSubscriptionsRepository } from './push-subscriptions/push-subscriptions.repository';
import { PushSubscriptionsService } from './push-subscriptions/push-subscriptions.service';
import { PushSubscriptionsController } from './push-subscriptions/push-subscriptions.controller';

@Module({
  imports: [PrismaModule, HouseholdsModule, NotificationsModule],
  providers: [
    NotificationRulesRepository,
    NotificationRulesService,
    RulesEngineService,
    InAppDispatcher,
    WebPushDispatcher,
    PushSubscriptionsRepository,
    PushSubscriptionsService,
  ],
  controllers: [NotificationRulesController, PushSubscriptionsController],
  exports: [NotificationRulesService, RulesEngineService, WebPushDispatcher],
})
export class NotificationRulesModule {}
