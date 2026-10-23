import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * In the container one service serves the API and the built web app, so the session cookie stays same-origin.
 * The web app routes in the browser (F-017), so a page request for any path outside /api gets index.html.
 * A request for a file, or one that does not ask for HTML, falls through to the usual 404.
 */
export function serveWeb(app: NestExpressApplication, dir: string): void {
  app.useStaticAssets(dir);
  const index = join(dir, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const page = (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/') && req.path !== '/api';
    if (page && !req.path.includes('.') && req.accepts(['html', 'json']) === 'html') res.sendFile(index);
    else next();
  });
}
