import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { AuthUser } from "../common/decorators/auth-user.decorator";
import { AuthCookieGuard } from "../common/guards/auth-cookie.guard";

import type { AuthUserContext } from "../common/decorators/auth-user.decorator";

import type { AiRateLimitService } from "./ai-rate-limit.service";
import type { AiService } from "./ai.service";
import type { DiagramToCodeDto } from "./dto/diagram-to-code.dto";
import type { TextToDiagramDto } from "./dto/text-to-diagram.dto";

import type { Response } from "express";

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string | null };
  headers?: Record<string, string | string[] | undefined>;
};

const parseFirstHeaderToken = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0]?.split(",")[0]?.trim() || null;
  }
  if (typeof value === "string") {
    return value.split(",")[0]?.trim() || null;
  }
  return null;
};

@ApiTags("ai")
@Controller("ai")
@UseGuards(AuthCookieGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiRateLimitService: AiRateLimitService,
  ) {}

  @Post("diagram-to-code/generate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate HTML from diagram context" })
  @ApiResponse({ status: 200, description: "Generated HTML payload" })
  async generateDiagramToCode(
    @AuthUser() authUser: AuthUserContext,
    @Req() request: RequestLike,
    @Body() input: DiagramToCodeDto,
  ) {
    this.aiRateLimitService.enforce({
      userId: authUser.userId,
      ip: this.resolveIp(request),
    });

    return this.aiService.generateDiagramToCode({
      userId: authUser.userId,
      texts: input.texts,
      image: input.image,
      theme: input.theme,
    });
  }

  @Post("text-to-diagram/chat-streaming")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate text-to-diagram response via SSE stream" })
  @ApiResponse({ status: 200, description: "SSE content/done/error events" })
  async textToDiagramStreaming(
    @AuthUser() authUser: AuthUserContext,
    @Req() request: RequestLike,
    @Res() response: Response,
    @Body() input: TextToDiagramDto,
  ) {
    this.aiRateLimitService.enforce({
      userId: authUser.userId,
      ip: this.resolveIp(request),
    });

    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();

    try {
      const generatedResponse = await this.aiService.generateTextToDiagram({
        userId: authUser.userId,
        messages: input.messages,
      });

      for (const chunk of this.chunkText(generatedResponse)) {
        response.write(
          `data: ${JSON.stringify({ type: "content", delta: chunk })}\n\n`,
        );
      }

      response.write(
        `data: ${JSON.stringify({ type: "done", finishReason: "stop" })}\n\n`,
      );
      response.end();
    } catch (error) {
      const status =
        typeof error === "object" &&
        error &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : 500;
      const message =
        error instanceof Error ? error.message : "AI text-to-diagram failed";

      response.write(
        `data: ${JSON.stringify({
          type: "error",
          error: { message, status },
        })}\n\n`,
      );
      response.end();
    }
  }

  private chunkText(value: string, chunkSize = 256) {
    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < value.length) {
      chunks.push(value.slice(cursor, cursor + chunkSize));
      cursor += chunkSize;
    }

    return chunks.length ? chunks : [""];
  }

  private resolveIp(request: RequestLike): string | null {
    const forwarded = parseFirstHeaderToken(
      request.headers?.["x-forwarded-for"],
    );
    if (forwarded) {
      return forwarded;
    }

    const realIp = parseFirstHeaderToken(request.headers?.["x-real-ip"]);
    if (realIp) {
      return realIp;
    }

    return request.ip || request.socket?.remoteAddress || null;
  }
}
