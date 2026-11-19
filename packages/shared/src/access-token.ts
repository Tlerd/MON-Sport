import { z } from 'zod';

export const ACCESS_TOKEN_PREFIX = 'mst_';
export const MAX_ACTIVE_ACCESS_TOKENS = 5;

export const AccessTokenScope = z.enum(['READ', 'BOOK']);
export type AccessTokenScope = z.infer<typeof AccessTokenScope>;

export const CreateAccessTokenRequest = z
  .object({
    name: z.string().trim().min(1).max(50),
    scope: AccessTokenScope,
    expiresInDays: z.union([z.literal(30), z.literal(90)]),
  })
  .strict();
export type CreateAccessTokenRequest = z.infer<typeof CreateAccessTokenRequest>;

export const AccessTokenView = z.object({
  id: z.uuid(),
  name: z.string(),
  scope: AccessTokenScope,
  prefix: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type AccessTokenView = z.infer<typeof AccessTokenView>;

export const CreateAccessTokenResponse = z.object({ token: AccessTokenView, secret: z.string() });
export type CreateAccessTokenResponse = z.infer<typeof CreateAccessTokenResponse>;

export const AccessTokenList = z.object({ tokens: z.array(AccessTokenView) });
export type AccessTokenList = z.infer<typeof AccessTokenList>;
