import type { Role } from '@monsport/shared';

/** Who calls the tools. A later step (PAT or OAuth) builds it. The tools never read a user id from their input. */
export interface McpContext {
  userId: string;
  role: Role;
}
