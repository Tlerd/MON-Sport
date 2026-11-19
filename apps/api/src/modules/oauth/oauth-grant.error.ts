export type OAuthGrantErrorCode = 'invalid_request' | 'invalid_grant' | 'invalid_target' | 'unsupported_grant_type';

export class OAuthGrantError extends Error {
  constructor(readonly error: OAuthGrantErrorCode) {
    super(error);
  }
}
