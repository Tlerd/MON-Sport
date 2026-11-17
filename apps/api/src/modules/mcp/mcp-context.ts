import type { AccessTokenScope, Role } from '@monsport/shared';

/** Who calls the tools. The route of `POST /api/mcp` builds it from the access token. The tools never read a user id from their input. */
export interface McpContext {
  userId: string;
  role: Role;
  scope: AccessTokenScope;
}
