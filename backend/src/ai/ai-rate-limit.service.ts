import { Injectable } from "@nestjs/common";

import { TooManyRequestsError } from "../common/exceptions/domain-errors";

import type { ConfigService } from "@nestjs/config";

@Injectable()
export class AiRateLimitService {
  private readonly userHits = new Map<string, number[]>();
  private readonly ipHits = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {}

  enforce(input: { userId: string; ip: string | null }) {
    const ttlSeconds = Number(
      this.configService.get<number>("AI_THROTTLE_TTL") || 60,
    );
    const ttlMs = ttlSeconds * 1000;
    const perUser = Number(
      this.configService.get<number>("AI_THROTTLE_LIMIT_PER_USER") || 20,
    );
    const perIp = Number(
      this.configService.get<number>("AI_THROTTLE_LIMIT_PER_IP") || 30,
    );

    this.enforceBucket(
      this.userHits,
      `user:${input.userId}`,
      perUser,
      ttlMs,
      "AI rate limit exceeded for user",
    );

    if (input.ip) {
      this.enforceBucket(
        this.ipHits,
        `ip:${input.ip}`,
        perIp,
        ttlMs,
        "AI rate limit exceeded for IP",
      );
    }
  }

  private enforceBucket(
    bucket: Map<string, number[]>,
    key: string,
    limit: number,
    ttlMs: number,
    errorMessage: string,
  ) {
    const now = Date.now();
    const windowStart = now - ttlMs;
    const history = (bucket.get(key) || []).filter(
      (timestamp) => timestamp >= windowStart,
    );

    if (history.length >= limit) {
      throw new TooManyRequestsError(errorMessage);
    }

    history.push(now);
    bucket.set(key, history);
  }
}
