import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IncomesModule } from './incomes/incomes.module';
import { CategoriesModule } from './categories/categories.module';
import { BudgetsModule } from './budgets/budgets.module';
import { HouseholdsModule } from './households/households.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'denaro'),
        password: config.get('DB_PASSWORD', 'denaro'),
        database: config.get('DB_NAME', 'denaro'),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNC', 'true') === 'true',
      }),
    }),
    AuthModule,
    UsersModule,
    IncomesModule,
    CategoriesModule,
    BudgetsModule,
    HouseholdsModule,
  ],
})
export class AppModule {}
