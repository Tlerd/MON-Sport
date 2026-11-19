import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { assertSessionSecret } from './modules/auth/session.js';
import { assertGoogleConfig } from './modules/auth/google.config.js';
import { assertOtpConfig } from './modules/otp/otp-config.js';
import { serveMobile, serveWeb } from './serve-web.js';
import { setupApp } from './setup-app.js';

assertSessionSecret();
assertOtpConfig();
assertGoogleConfig();
const app = setupApp(await NestFactory.create<NestExpressApplication>(AppModule));
if (process.env.MOBILE_DIST) serveMobile(app, process.env.MOBILE_DIST);
if (process.env.WEB_DIST) serveWeb(app, process.env.WEB_DIST);
await app.listen(Number(process.env.PORT ?? 3000));
