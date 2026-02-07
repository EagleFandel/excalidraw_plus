import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      throw new HttpException({ ok: false, db: false }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
