import { type INestApplication, RequestMethod } from '@nestjs/common';

// The server and the tests both call this, so they serve the same routes.
export function setupApp<T extends INestApplication>(app: T): T {
  // The two OAuth discovery routes live at the root, as RFC 8414 and RFC 9728 require (brief F-038).
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '.well-known/oauth-protected-resource/api/mcp', method: RequestMethod.GET },
      { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
    ],
  });
  // Cloud Run adds the client address at the end of X-Forwarded-For. Trusting one hop makes req.ip that last entry,
  // so a client cannot pick its own address for the login limits by sending the header (brief F-006).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();
  return app;
}
