import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuditService } from '../audit/audit.service';
import { Public } from '../common/decorators/public.decorator';
import type { RequestContext } from '../common/types/request-context.type';
import { OAuthService } from '../oauth/oauth.service';
import { OAuthBearerGuard } from './guards/oauth-bearer.guard';
import { McpServerFactory } from './mcp-server.factory';

/**
 * MCP Resource Server — `POST /mcp` (Streamable HTTP).
 *
 * Auth: OAuth-Bearer (klar-mcp audience). Globaler `JwtAuthGuard` wird durch
 * `@Public()` deaktiviert; stattdessen kommt `OAuthBearerGuard` zum Zug, der
 * den per OAuth-Flow ausgestellten JWT prüft.
 *
 * `GET /mcp` ist erlaubt um SSE-Streams aufrechtzuerhalten — wird vom
 * Streamable-HTTP-Transport selbst behandelt.
 */
@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly factory: McpServerFactory,
    private readonly oauthService: OAuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @UseGuards(OAuthBearerGuard)
  @Post()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'MCP Streamable HTTP entry point',
    description:
      'Implements the MCP HTTP+SSE transport. Each request is a JSON-RPC 2.0 envelope; tool names and arg schemas are discoverable via the `tools/list` method, then invoked via `tools/call`. Authentication is OAuth-Bearer (audience `klar-mcp`) — a JWT issued through Klar\'s OAuth flow, not the regular SPA JWT. See https://modelcontextprotocol.io for the protocol spec.',
  })
  @ApiBody({
    description: 'JSON-RPC 2.0 envelope.',
    schema: {
      type: 'object',
      required: ['jsonrpc', 'method'],
      properties: {
        jsonrpc: { type: 'string', enum: ['2.0'], example: '2.0' },
        id: { oneOf: [{ type: 'string' }, { type: 'number' }], example: 1 },
        method: { type: 'string', example: 'tools/list' },
        params: { type: 'object', example: {} },
      },
      example: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'JSON-RPC 2.0 response envelope (or SSE stream for long-running tool calls).',
    schema: {
      type: 'object',
      example: {
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            { name: 'transactions.list', description: 'List transactions', inputSchema: { type: 'object' } },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid OAuth bearer token.' })
  @ApiResponse({ status: 403, description: 'Token is valid but lacks the required scope for this tool.' })
  async handlePost(
    @Req() req: FastifyRequest & { reqContext: RequestContext },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Auto-Detect Client-Name aus dem MCP `initialize`-Request.
    // mcp-remote füllt clientInfo.name mit dem echten LLM-Client (z.B.
    // "claude-ai (via mcp-remote 0.1.37)") — viel besser als der generische
    // "MCP CLI Proxy", den mcp-remote bei der OAuth-Registration verwendet.
    this.maybeCaptureClientName(req.reqContext.mcpClientId, req.body);
    this.maybeAuditSessionStart(req.reqContext, req.body);

    const { transport, server } = await this.factory.createServer(req.reqContext);
    try {
      // Fastify liefert raw Node-Req/Res via .raw
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } finally {
      await server.close();
    }
  }

  private maybeAuditSessionStart(ctx: RequestContext, body: unknown): void {
    if (typeof body !== 'object' || body === null) return;
    const msg = body as { method?: unknown; params?: unknown };
    if (msg.method !== 'initialize') return;
    const params = msg.params as
      | {
          clientInfo?: { name?: unknown; version?: unknown };
          protocolVersion?: unknown;
        }
      | undefined;
    const clientName = typeof params?.clientInfo?.name === 'string' ? params.clientInfo.name : undefined;
    const clientVersion =
      typeof params?.clientInfo?.version === 'string' ? params.clientInfo.version : undefined;
    const protocolVersion =
      typeof params?.protocolVersion === 'string' ? params.protocolVersion : undefined;
    this.audit.log({
      userId: ctx.userId,
      householdId: ctx.householdId,
      action: 'mcp.session.start',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: {
        clientId: ctx.mcpClientId,
        ...(clientName !== undefined ? { clientName } : {}),
        ...(clientVersion !== undefined ? { clientVersion } : {}),
        ...(protocolVersion !== undefined ? { protocolVersion } : {}),
      },
    });
  }

  private maybeCaptureClientName(clientId: string | undefined, body: unknown): void {
    if (!clientId) return;
    if (typeof body !== 'object' || body === null) return;
    const msg = body as { method?: unknown; params?: unknown };
    if (msg.method !== 'initialize') return;
    const params = msg.params as { clientInfo?: { name?: unknown } } | undefined;
    const name = params?.clientInfo?.name;
    if (typeof name !== 'string' || name.length === 0) return;
    // Fire-and-forget — soll nie den Request-Pfad blocken oder fehlschlagen.
    this.oauthService.autoSetClientDisplayNameIfMissing(clientId, name).catch((err) => {
      this.logger.warn(
        `Failed to auto-set client display name for ${clientId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  /**
   * GET wird vom Streamable-HTTP-Transport für SSE-Aufbau benutzt.
   * Wir lehnen aktuell ab (stateless mode) — der Spec erlaubt 405.
   */
  @Public()
  @UseGuards(OAuthBearerGuard)
  @Get()
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'MCP SSE stream (stateless mode: not supported)',
    description:
      'The MCP Streamable HTTP transport may use `GET /mcp` to open a server-sent-events stream. Klar runs in stateless mode and rejects this with `405 Method Not Allowed` — the spec permits this. All MCP traffic flows through `POST /mcp` instead.',
  })
  @ApiResponse({
    status: 405,
    description: 'GET is not supported in stateless mode.',
    schema: {
      example: { error: 'method_not_allowed', error_description: 'GET not supported in stateless mode' },
    },
  })
  handleGet(@Res() reply: FastifyReply): void {
    void reply
      .code(HttpStatus.METHOD_NOT_ALLOWED)
      .header('Allow', 'POST')
      .send({ error: 'method_not_allowed', error_description: 'GET not supported in stateless mode' });
  }
}
