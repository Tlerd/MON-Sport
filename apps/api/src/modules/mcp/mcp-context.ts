import type { AccessTokenScope, Role } from '@monsport/shared';

export interface McpContext {
  userId: string;
  role: Role;
  scope: AccessTokenScope;
}
