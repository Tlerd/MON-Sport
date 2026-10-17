import type { INestApplication } from '@nestjs/common';

// The server and the tests both call this, so they serve the same routes.
export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api');
  // Cloud Run adds the client address at the end of X-Forwarded-For. Trusting one hop makes req.ip that last entry,
  // so a client cannot pick its own address for the login limits by sending the header (brief F-006).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();
  return app;
}
