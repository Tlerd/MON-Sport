import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Dung chung boi main.ts (chay that) va test e2e (Test.createTestingModule) —
// ca hai deu phai co cookie-parser + exception filter de test phan anh dung san xuat.
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Web goi qua "/api/*" (xem apps/web/vite.config.ts proxy) — dat o day (khong
  // chi trong main.ts) de test e2e cung chay dung tien to nhu san xuat that.
  app.setGlobalPrefix('api');
}
