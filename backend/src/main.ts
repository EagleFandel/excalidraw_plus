import "dotenv/config";
import "reflect-metadata";

import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();

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

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    credentials: true,
  });

  const port = Number(process.env.BACKEND_PORT || process.env.PORT || 3005);
  const host = process.env.BACKEND_HOST || "0.0.0.0";

  await app.listen(port, host);

  process.stdout.write(
    `[backend] listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}\n`,
  );
};

bootstrap().catch((error) => {
  process.stderr.write(
    `[backend] bootstrap failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
