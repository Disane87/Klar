import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { RequestMethod } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
    credentials: true,
  });

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
