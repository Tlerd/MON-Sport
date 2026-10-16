import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { assertSessionSecret } from './modules/auth/session.js';
import { setupApp } from './setup-app.js';

assertSessionSecret(); // Fail at start, not at the first login.
const app = setupApp(await NestFactory.create(AppModule));
await app.listen(Number(process.env.PORT ?? 3000));
