import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Serves the mobile app (PWA) under /app/ from MOBILE_DIST (F-019).
 * Registered before serveWeb so /app/... routes do not hit the web fallback.
 */
export function serveMobile(app: NestExpressApplication, dir: string): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/app') {
      const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      res.redirect(301, `/app/${q}`);
      return;
    }
    next();
  });
  app.useStaticAssets(dir, { prefix: '/app', index: false });
  const index = resolve(dir, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const p = req.path.toLowerCase();
    const isApp = p === '/app/' || p.startsWith('/app/');
    const page = (req.method === 'GET' || req.method === 'HEAD') && isApp;
    if (page && !req.path.includes('.') && req.accepts(['html', 'json']) === 'html') {
      res.sendFile(index);
    } else {
      next();
    }
  });
}

/**
 * In the container one service serves the API and the built web app, so the session cookie stays same-origin.
 * The web app routes in the browser (F-017), so a page request for any path outside /api gets index.html.
 * A request for a file, or one that does not ask for HTML, falls through to the usual 404.
 */
export function serveWeb(app: NestExpressApplication, dir: string): void {
  app.useStaticAssets(dir);
  const index = resolve(dir, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const p = req.path.toLowerCase();
    const page = (req.method === 'GET' || req.method === 'HEAD') && !p.startsWith('/api/') && p !== '/api';
    if (page && !req.path.includes('.') && req.accepts(['html', 'json']) === 'html') {
      // Brief F-038 (AC-20): no site may frame the "Cho phép" screen (clickjacking).
      if (p === '/ket-noi-ai' || p.startsWith('/ket-noi-ai/')) res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      res.sendFile(index);
    } else next();
  });
}
