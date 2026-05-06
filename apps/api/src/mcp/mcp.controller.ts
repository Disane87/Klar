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
  handleGet(@Res() reply: FastifyReply): void {
    void reply
      .code(HttpStatus.METHOD_NOT_ALLOWED)
      .header('Allow', 'POST')
      .send({ error: 'method_not_allowed', error_description: 'GET not supported in stateless mode' });
  }
}
