import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { assertSessionSecret } from './modules/auth/session.js';
import { serveWeb } from './serve-web.js';
import { setupApp } from './setup-app.js';

assertSessionSecret(); // Fail at start, not at the first login.
const app = setupApp(await NestFactory.create<NestExpressApplication>(AppModule));
if (process.env.WEB_DIST) serveWeb(app, process.env.WEB_DIST);
await app.listen(Number(process.env.PORT ?? 3000));
