import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { Controller, Delete, Get, Logger, Post, Req, Res } from '@nestjs/common';
import { ACCESS_TOKEN_PREFIX, OAUTH_ACCESS_TOKEN_PREFIX } from '@monsport/shared';
import type { Request, Response } from 'express';
import { AccessTokensService } from '../access-tokens/access-tokens.service.js';
import { OAuthService } from '../oauth/oauth.service.js';
import type { McpContext } from './mcp-context.js';
import { McpService } from './mcp.service.js';

const FORBIDDEN = 'Bạn không có quyền làm việc này';
const INVALID_TOKEN = 'Mã truy cập không hợp lệ';
const GENERIC = 'Có lỗi xảy ra. Thử lại sau';
// RFC 7235, section 2.1: the scheme name is case-insensitive.
const BEARER = /^Bearer\s+(\S+)$/i;

/** RFC 9728: with PUBLIC_ORIGIN the 401 names the metadata URL. Without it the header stays `Bearer`, as in F-037. */
function challenge(): string {
  const origin = (process.env.PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!origin) return 'Bearer';
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", scope="read book"`;
}

/**
 * Brief F-037, step 3, and F-038. A stateless MCP endpoint. A browser request (Origin header) is refused first (AC-10).
 * Only the header `Authorization: Bearer mst_...` or `Bearer mot_...` counts. A cookie is ignored. This class never logs a header, a body, or a token.
 */
@Controller()
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcp: McpService,
    private readonly tokens: AccessTokensService,
    private readonly oauth: OAuthService,
  ) {}

  /** Picks the check by the token prefix: `mst_` is a personal access token, `mot_` is an OAuth access token. */
  private async authenticate(token: string): Promise<McpContext | null> {
    if (token.startsWith(ACCESS_TOKEN_PREFIX)) return this.tokens.authenticate(token);
    if (token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) return this.oauth.authenticate(token);
    return null;
  }

  @Post('mcp')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.headers.origin !== undefined) {
      res.status(403).json({ message: FORBIDDEN });
      return;
    }
    try {
      const match = BEARER.exec(req.headers.authorization ?? '');
      const ctx = match ? await this.authenticate(match[1]) : null;
      if (!ctx) {
        res.status(401).setHeader('WWW-Authenticate', challenge()).json({ message: INVALID_TOKEN });
        return;
      }
      const server = this.mcp.createServer({ userId: ctx.userId, role: ctx.role, scope: ctx.scope });
      const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        // A rejected close must not become an unhandledRejection, which stops the process.
        transport.close().catch(() => undefined);
        server.close().catch(() => undefined);
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error('mcp request failed', error instanceof Error ? error.stack : 'unknown error');
      if (!res.headersSent) res.status(500).json({ message: GENERIC });
    }
  }

  // One route decorator for each method: Nest keeps only one path and method per handler (AC-11).
  @Get('mcp')
  getNotAllowed(@Res() res: Response): void {
    notAllowed(res);
  }

  @Delete('mcp')
  deleteNotAllowed(@Res() res: Response): void {
    notAllowed(res);
  }
}

function notAllowed(res: Response): void {
  res.status(405).setHeader('Allow', 'POST').json({ message: 'Method Not Allowed' });
}
