import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { resolveAllowedOrigins } from "./config/cors.config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.BACKEND_PORT ?? 4000);
  const host = process.env.BACKEND_HOST?.trim() || undefined;

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.enableCors({
    credentials: true,
    origin: resolveAllowedOrigins(),
  });
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  if (host) {
    await app.listen(port, host);
  } else {
    await app.listen(port);
  }
}

void bootstrap();
