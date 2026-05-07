import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ConnectedAppsRepository } from './connected-apps.repository';
import { ConnectedAppsService } from './connected-apps.service';
import { ConnectedAppsController } from './connected-apps.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [ConnectedAppsRepository, ConnectedAppsService],
  controllers: [ConnectedAppsController],
  exports: [ConnectedAppsService],
})
export class ConnectedAppsModule {}
