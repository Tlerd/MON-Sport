import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

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

export function serveWeb(app: NestExpressApplication, dir: string): void {
  app.useStaticAssets(dir);
  const index = resolve(dir, 'index.html');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const p = req.path.toLowerCase();
    const page = (req.method === 'GET' || req.method === 'HEAD') && !p.startsWith('/api/') && p !== '/api';
    if (page && !req.path.includes('.') && req.accepts(['html', 'json']) === 'html') {
      if (p === '/ket-noi-ai' || p.startsWith('/ket-noi-ai/')) res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      res.sendFile(index);
    } else next();
  });
}
