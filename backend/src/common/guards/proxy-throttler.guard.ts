import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string | null };
};

const parseFirstHeaderToken = (value?: string | string[]): string | null => {
  if (Array.isArray(value)) {
    const first = value[0]?.split(",")[0]?.trim();
    return first || null;
  }

  if (typeof value === "string") {
    const first = value.split(",")[0]?.trim();
    return first || null;
  }

  return null;
};

const normalizeAddress = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.replace("::ffff:", "");
  }

  return trimmed;
};

const isLoopbackLike = (ip: string) => {
  return ip === "127.0.0.1" || ip === "::1";
};

@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: RequestLike): Promise<string> {
    const directIp = normalizeAddress(request.ip);
    const remoteIp = normalizeAddress(request.socket?.remoteAddress || null);
    const trustForwardedHeaders = Boolean(
      directIp && (isLoopbackLike(directIp) || directIp === remoteIp),
    );

    if (trustForwardedHeaders) {
      const forwardedIp = normalizeAddress(
        parseFirstHeaderToken(request.headers?.["x-forwarded-for"]),
      );
      if (forwardedIp) {
        return forwardedIp;
      }

      const realIp = normalizeAddress(
        parseFirstHeaderToken(request.headers?.["x-real-ip"]),
      );
      if (realIp) {
        return realIp;
      }
    }

    return directIp || remoteIp || "unknown";
  }
}
