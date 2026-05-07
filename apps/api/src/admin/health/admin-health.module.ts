import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminHealthController } from './admin-health.controller';
import { AdminHealthServiceImpl } from './admin-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminHealthController],
  providers: [AdminHealthServiceImpl],
})
export class AdminHealthModule {}
