import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { NotificationRulesRepository } from './notification-rules.repository';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRulesController } from './notification-rules.controller';
import { RulesEngineService } from './rules-engine.service';
import { InAppDispatcher } from './dispatchers/in-app.dispatcher';
import { WebPushDispatcher } from './dispatchers/web-push.dispatcher';
import { EmailDispatcher } from './dispatchers/email.dispatcher';
import { PushSubscriptionsRepository } from './push-subscriptions/push-subscriptions.repository';
import { PushSubscriptionsService } from './push-subscriptions/push-subscriptions.service';
import { PushSubscriptionsController } from './push-subscriptions/push-subscriptions.controller';
import { DigestQueueRepository } from './digest/digest-queue.repository';
import { DigestScheduler } from './digest/digest.scheduler';
import { StandingOrderDueScheduler } from './producers/standing-order-due.scheduler';
import { BudgetThresholdService } from './producers/budget-threshold.service';

@Module({
  imports: [PrismaModule, HouseholdsModule, NotificationsModule, MailModule],
  providers: [
    NotificationRulesRepository,
    NotificationRulesService,
    RulesEngineService,
    InAppDispatcher,
    WebPushDispatcher,
    EmailDispatcher,
    PushSubscriptionsRepository,
    PushSubscriptionsService,
    DigestQueueRepository,
    DigestScheduler,
    StandingOrderDueScheduler,
    BudgetThresholdService,
  ],
  controllers: [NotificationRulesController, PushSubscriptionsController],
  exports: [NotificationRulesService, RulesEngineService, WebPushDispatcher, EmailDispatcher],
})
export class NotificationRulesModule {}
