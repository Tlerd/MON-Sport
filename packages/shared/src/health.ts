import { z } from 'zod';

// Response of GET /api/health. The web app shows it, and CI uses it to prove the API reaches Postgres.
export const HealthResponse = z.object({
  status: z.enum(['ok', 'error']),
  db: z.enum(['up', 'down']),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
