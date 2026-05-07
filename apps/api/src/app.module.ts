import { join } from 'path';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { HouseholdsModule } from './households/households.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ProjectsModule } from './projects/projects.module';
import { RecurringTransactionsModule } from './recurring-transactions/recurring-transactions.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { OverviewModule } from './overview/overview.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { MailTemplatesModule } from './mail-templates/mail-templates.module';
import { DataTransferModule } from './data-transfer/data-transfer.module';
import { CsvImportModule } from './csv-import/csv-import.module';
import { AdminModule } from './admin/admin.module';
import { OAuthModule } from './oauth/oauth.module';
import { McpModule } from './mcp/mcp.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContractsModule } from './contracts/contracts.module';
import { ConnectedAppsModule } from './connected-apps/connected-apps.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.apiKey',
          'req.body.secret',
          'req.body.hashedSecret',
          'req.body.token',
          'req.body.accessToken',
          'req.body.refreshToken',
          'req.body.tokenHash',
          'req.body.code',
          'req.body.codeVerifier',
          'req.body.state',
          'req.body.clientSecret',
          // OAuth 2.1 / MCP
          'req.body.code_verifier',
          'req.body.refresh_token',
          'req.body.access_token',
          'req.body.client_secret',
          'req.body.registration_access_token',
          'res.body.access_token',
          'res.body.refresh_token',
          'res.body.client_secret',
          'res.body.registration_access_token',
        ],
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
      // Skip throttling in test environment so E2E tests can register/login freely
      skipIf: () => process.env['NODE_ENV'] === 'test',
    }]),
    AppConfigModule,
    PrismaModule,
    MailModule,
    AuditModule,
    UsersModule,
    HouseholdsModule,
    AuthModule,
    CategoriesModule,
    ProjectsModule,
    RecurringTransactionsModule,
    TransactionsModule,
    BudgetsModule,
    OverviewModule,
    ApiKeysModule,
    MailTemplatesModule,
    DataTransferModule,
    CsvImportModule,
    AdminModule,
    OAuthModule,
    McpModule,
    NotificationsModule,
    ContractsModule,
    ConnectedAppsModule,
    HealthModule,
    ...(process.env['NODE_ENV'] === 'production'
      ? [ServeStaticModule.forRoot({
          rootPath: join(process.cwd(), 'web'),
          exclude: ['/api/*path', '/health'],
          serveStaticOptions: { fallthrough: true },
        })]
      : []),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
