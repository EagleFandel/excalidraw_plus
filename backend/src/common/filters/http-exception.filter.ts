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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    if (exception instanceof DomainError) {
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
            message:
              typeof body === "string"
                ? body
                : (body as { message?: string | string[] })?.message?.toString() ||
                  "Invalid input",
          },
        });
        return;
      }

      response.status(status).json({
        error: {
          code: "INTERNAL_ERROR",
          message:
            (typeof body === "string"
              ? body
              : (body as { message?: string | string[] })?.message?.toString()) ||
            exception.message ||
            "Internal server error",
        },
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack || exception.message : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  }
}
