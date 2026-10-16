import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { assertSessionSecret } from './modules/auth/session.js';
import { setupApp } from './setup-app.js';

assertSessionSecret(); // Fail at start, not at the first login.
const app = setupApp(await NestFactory.create<NestExpressApplication>(AppModule));
// In the container one service serves the API and the built web app, so the session cookie stays same-origin.
if (process.env.WEB_DIST) app.useStaticAssets(process.env.WEB_DIST);
await app.listen(Number(process.env.PORT ?? 3000));
