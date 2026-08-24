import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://mazettofood.uz",
  "https://www.mazettofood.uz",
  "https://pos.mazettofood.uz",
];

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.BACKEND_PORT ?? 4000);

  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
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

  await app.listen(port);
}

void bootstrap();
