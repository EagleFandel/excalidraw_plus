import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import type { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Health check" })
  @ApiResponse({ status: 200, description: "Service healthy" })
  @ApiResponse({ status: 503, description: "Database unavailable" })
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      throw new HttpException(
        { ok: false, db: false },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
