import "dotenv/config";
import "reflect-metadata";

import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { RequestLogInterceptor } from "./common/interceptors/request-log.interceptor";
import { MetricsService } from "./common/metrics/metrics.service";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  app.get(ConfigService);

  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  expressApp.set("trust proxy", 1);
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLogInterceptor());
  app.useGlobalGuards(app.get(CsrfGuard));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    credentials: true,
  });

  const metricsService = app.get(MetricsService);
  expressApp.use(
    (
      request: { method?: string; path?: string },
      _response: unknown,
      next: () => void,
    ) => {
      metricsService.incrementCounter("excplus_requests_total", {
        method: request.method || "GET",
        path: request.path || "",
      });
      next();
    },
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Excalidraw+ API")
    .setDescription("Excalidraw+ backend API documentation")
    .setVersion("1.0.0")
    .build();

  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: false,
  });

  SwaggerModule.setup("api/docs", app, openApiDocument, {
    jsonDocumentUrl: "/api/docs-json",
  });
  expressApp.get(
    "/api/docs-json",
    (_request: unknown, response: { json: (body: unknown) => void }) => {
      response.json(openApiDocument);
    },
  );

  const port = Number(process.env.BACKEND_PORT || process.env.PORT || 3005);
  const host = process.env.BACKEND_HOST || "0.0.0.0";

  await app.listen(port, host);

  process.stdout.write(
    `[backend] listening on http://${
      host === "0.0.0.0" ? "localhost" : host
    }:${port}\n`,
  );
};

bootstrap().catch((error) => {
  process.stderr.write(
    `[backend] bootstrap failed: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
