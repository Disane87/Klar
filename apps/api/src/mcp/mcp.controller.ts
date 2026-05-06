import {
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import type { RequestContext } from '../common/types/request-context.type';
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
  constructor(private readonly factory: McpServerFactory) {}

  @Public()
  @UseGuards(OAuthBearerGuard)
  @Post()
  async handlePost(
    @Req() req: FastifyRequest & { reqContext: RequestContext },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { transport, server } = await this.factory.createServer(req.reqContext);
    try {
      // Fastify liefert raw Node-Req/Res via .raw
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } finally {
      await server.close();
    }
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
