import type { INestApplication } from '@nestjs/common';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

const contentSecurityPolicy = {
  useDefaults: false,
  directives: {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'connect-src': ["'self'"],
    'font-src': ["'self'", 'data:', GOOGLE_FONTS_FILES],
    'frame-ancestors': ["'self'"],
    'img-src': ["'self'", 'data:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'", GOOGLE_FONTS_CSS],
    'worker-src': ["'self'"],
  },
};

export function applySecurityHeaders(app: INestApplication): void {
  const express: Express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy,
      crossOriginOpenerPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
}

export function denyFraming(res: Response): void {
  const current = res.getHeader('Content-Security-Policy');
  const csp = typeof current === 'string' ? current : '';
  const denied = csp.includes('frame-ancestors')
    ? csp.replace(/frame-ancestors [^;]*/, "frame-ancestors 'none'")
    : [csp, "frame-ancestors 'none'"].filter(Boolean).join(';');
  res.setHeader('Content-Security-Policy', denied);
}
