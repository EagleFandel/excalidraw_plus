import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

import { DomainError } from "../exceptions/domain-errors";

type RequestLike = {
  requestId?: string;
  method?: string;
  originalUrl?: string;
  url?: string;
};

const getMessageFromHttpExceptionBody = (
  body: unknown,
  fallback: string,
): string => {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (typeof body === "object" && body) {
    const message = (body as { message?: string | string[] }).message;
    if (Array.isArray(message)) {
      return message.join(", ");
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }

    const nestedMessage = (
      body as { error?: { message?: string } }
    ).error?.message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  return fallback;
};

const getCodeFromHttpExceptionBody = (body: unknown): string | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const directCode = (body as { code?: string }).code;
  if (typeof directCode === "string" && directCode.trim()) {
    return directCode;
  }

  const nestedCode = (body as { error?: { code?: string } }).error?.code;
  if (typeof nestedCode === "string" && nestedCode.trim()) {
    return nestedCode;
  }

  return null;
};

const mapStatusToErrorCode = (status: number): string => {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "INVALID_INPUT";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? "INTERNAL_ERROR"
        : "REQUEST_FAILED";
  }
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestLike>();

    const logError = (
      status: number,
      errorCode: string,
      message: string,
      stack?: string,
    ) => {
      this.logger.error(
        JSON.stringify({
          requestId: request?.requestId,
          method: request?.method,
          path: request?.originalUrl || request?.url,
          status,
          code: errorCode,
          message,
          ...(stack ? { stack } : {}),
        }),
      );
    };

    if (exception instanceof DomainError) {
      if (exception.status >= 500) {
        logError(
          exception.status,
          exception.code,
          exception.message,
          exception.stack,
        );
      }

      response.status(exception.status).json({
        error: {
          code: exception.code,
          message: exception.message,
        },
        ...(exception.extras || {}),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        response.status(HttpStatus.SERVICE_UNAVAILABLE).json(
          typeof body === "object" && body ? body : { ok: false, db: false },
        );
        return;
      }

      if (status === HttpStatus.BAD_REQUEST) {
        response.status(HttpStatus.BAD_REQUEST).json({
          error: {
            code: "INVALID_INPUT",
            message: getMessageFromHttpExceptionBody(body, "Invalid input"),
          },
        });
        return;
      }

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        response.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests",
          },
        });
        return;
      }

      const errorCode =
        getCodeFromHttpExceptionBody(body) || mapStatusToErrorCode(status);
      const message = getMessageFromHttpExceptionBody(
        body,
        exception.message ||
          (status >= HttpStatus.INTERNAL_SERVER_ERROR
            ? "Internal server error"
            : "Request failed"),
      );

      response.status(status).json({
        error: {
          code: errorCode,
          message,
        },
      });

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        logError(
          status,
          errorCode,
          message,
          exception.stack,
        );
      }
      return;
    }

    logError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "INTERNAL_ERROR",
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  }
}
