import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

const app = setupApp(await NestFactory.create(AppModule));
await app.listen(Number(process.env.PORT ?? 3000));
