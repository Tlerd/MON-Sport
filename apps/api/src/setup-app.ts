import type { INestApplication } from '@nestjs/common';

// The server and the tests both call this, so they serve the same routes.
export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}
