import { type INestApplication, RequestMethod } from '@nestjs/common';
import { applySecurityHeaders } from './security-headers.js';

export function setupApp<T extends INestApplication>(app: T): T {
  applySecurityHeaders(app);
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '.well-known/oauth-protected-resource/api/mcp', method: RequestMethod.GET },
      { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
    ],
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();
  return app;
}
