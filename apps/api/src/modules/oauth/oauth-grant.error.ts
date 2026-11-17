/** RFC 6749, section 5.2: the codes the token route gives in `{ error }` with status 400. */
export type OAuthGrantErrorCode = 'invalid_request' | 'invalid_grant' | 'unsupported_grant_type';

/** Thrown by `OAuthService.token`. The controller turns it into a 400 JSON body. It never holds a token or a code. */
export class OAuthGrantError extends Error {
  constructor(readonly error: OAuthGrantErrorCode) {
    super(error);
  }
}
