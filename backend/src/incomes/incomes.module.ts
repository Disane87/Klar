import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Income } from './income.entity';
import { IncomesService } from './incomes.service';
import { IncomesController } from './incomes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Income])],
  providers: [IncomesService],
  controllers: [IncomesController],
  exports: [IncomesService],
})
export class IncomesModule {}
