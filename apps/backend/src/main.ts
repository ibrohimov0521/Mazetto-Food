import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { getAllowedOrigins } from "./config/cors.config";
import { loadEnvironmentFile, validateEnvironment } from "./config/env";

async function bootstrap(): Promise<void> {
  /*
   * Env AVVAL yuklanadi va tekshiriladi — Nest konteyneri qurilishidan oldin.
   *
   * Prisma xizmat konstruktorida `DATABASE_URL` ni talab qiladi, ya'ni bu
   * tartib buzilsa nosozlik "Prisma ishga tushmadi" bo'lib ko'rinadi, aslida
   * esa muammo konfiguratsiyada bo'ladi (7-bosqich Q3.1).
   */
  loadEnvironmentFile();
  const env = validateEnvironment();

  const app = await NestFactory.create(AppModule);
  const port = env.BACKEND_PORT;

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

  /*
   * API hujjati — faqat ATAYLAB yoqilganda (7-bosqich Q3.2).
   *
   * `SWAGGER_ENABLED` default'i `false` va ishlab chiqarishda shunday
   * qolishi kerak: hujjat ichki endpoint tuzilishini ochib beradi.
   *
   * Yon foyda: `docs/admin-redesign/03-current-state/BACKEND_API_INVENTORY.md`
   * QO'LDA yig'ilgan va eskirib boradi — Swagger uni bepul va doim
   * yangi holda beradi.
   */
  if (env.SWAGGER_ENABLED && env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("MAZETTO FOOD API")
      .setDescription("Restoran platformasi — POS, admin va mijoz API'si")
      .setVersion("1.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "access-token",
      )
      .build();

    SwaggerModule.setup(
      "api/v1/docs",
      app,
      SwaggerModule.createDocument(app, config),
      { swaggerOptions: { persistAuthorization: true } },
    );
  }

  await app.listen(port);
}

void bootstrap();
