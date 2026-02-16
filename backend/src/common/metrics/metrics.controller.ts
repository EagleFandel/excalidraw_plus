import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { MetricsService } from "./metrics.service";

@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  getMetrics() {
    const enabled = this.configService.get<boolean>("METRICS_ENABLED") || false;
    if (!enabled) {
      throw new NotFoundException();
    }

    return this.metricsService.renderPrometheusText();
  }
}
