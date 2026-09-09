import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { getAllowedOrigins } from "./config/cors.config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.BACKEND_PORT ?? 4000);

  /*
   * Xavfsizlik header'lari (PHASE 6 H3). Backend faqat JSON API qaytaradi va
   * brauzerda sahifa render qilmaydi, shuning uchun standart to'plam yetarli.
   *
   * `crossOriginResourcePolicy` o'chirilgan: standart `same-origin` qiymati
   * boshqa origin'dagi customer-web va POS'ning javoblarni o'qishini bloklab
   * qo'yardi — CORS ro'yxati bu ishni allaqachon bajaradi.
   */
  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.enableCors({
    credentials: true,
    origin: getAllowedOrigins(),
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
