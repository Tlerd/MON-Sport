import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { Controller, Delete, Get, Logger, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessTokensService } from '../access-tokens/access-tokens.service.js';
import { McpService } from './mcp.service.js';

const FORBIDDEN = 'Bạn không có quyền làm việc này';
const INVALID_TOKEN = 'Mã truy cập không hợp lệ';
const GENERIC = 'Có lỗi xảy ra. Thử lại sau';
// RFC 7235, section 2.1: the scheme name is case-insensitive.
const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Brief F-037, step 3. A stateless MCP endpoint. A browser request (Origin header) is refused first (AC-10).
 * Only the header `Authorization: Bearer mst_...` counts. A cookie is ignored. This class never logs a header, a body, or a token.
 */
@Controller()
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcp: McpService,
    private readonly tokens: AccessTokensService,
  ) {}

  @Post('mcp')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.headers.origin !== undefined) {
      res.status(403).json({ message: FORBIDDEN });
      return;
    }
    try {
      const match = BEARER.exec(req.headers.authorization ?? '');
      const ctx = match ? await this.tokens.authenticate(match[1]) : null;
      if (!ctx) {
        res.status(401).setHeader('WWW-Authenticate', 'Bearer').json({ message: INVALID_TOKEN });
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
