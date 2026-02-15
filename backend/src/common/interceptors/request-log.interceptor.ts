import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Observable, tap } from "rxjs";

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type ResponseLike = {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
};

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HttpRequest");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();
    const startedAt = Date.now();

    const requestIdHeader = request.headers?.["x-request-id"];
    const requestId =
      (Array.isArray(requestIdHeader)
        ? requestIdHeader[0]
        : requestIdHeader) || randomUUID();

    request.requestId = requestId;
    response.setHeader?.("x-request-id", requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = Date.now() - startedAt;
          this.logger.log(
            JSON.stringify({
              requestId,
              method: request.method,
              path: request.originalUrl || request.url,
              status: response.statusCode,
              latencyMs,
            }),
          );
        },
        error: (error) => {
          const latencyMs = Date.now() - startedAt;
          const fallbackStatus =
            error instanceof HttpException
              ? error.getStatus()
              : typeof (error as { status?: unknown })?.status === "number"
              ? Number((error as { status: number }).status)
              : 500;
          const statusCode =
            typeof response.statusCode === "number" && response.statusCode >= 400
              ? response.statusCode
              : fallbackStatus;

          this.logger.error(
            JSON.stringify({
              requestId,
              method: request.method,
              path: request.originalUrl || request.url,
              status: statusCode,
              latencyMs,
              error:
                error instanceof Error ? error.message : String(error || "unknown"),
            }),
          );
        },
      }),
    );
  }
}
