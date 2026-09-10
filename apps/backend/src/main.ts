import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { resolveAllowedOrigins } from "./config/cors.config";
import { loadEnvironmentFile, validateEnvironment } from "./config/env";

async function bootstrap(): Promise<void> {
  /*
   * Env AVVAL yuklanadi va tekshiriladi — Nest konteyneri qurilishidan oldin.
   *
   * Prisma xizmat konstruktorida `DATABASE_URL` ni talab qiladi, ya'ni bu
   * tartib buzilsa nosozlik "Prisma ishga tushmadi" bo'lib ko'rinadi, aslida
   * esa muammo konfiguratsiyada bo'ladi.
   */
  loadEnvironmentFile();
  const env = validateEnvironment();

  const app = await NestFactory.create(AppModule);
  const port = env.BACKEND_PORT;
  const host = env.BACKEND_HOST;

  /*
   * Xavfsizlik header'lari. Backend faqat JSON API qaytaradi va brauzerda
   * sahifa render qilmaydi, shuning uchun standart to'plam yetarli.
   *
   * `crossOriginResourcePolicy` ATAYLAB `cross-origin`: standart `same-origin`
   * qiymati boshqa origin'dagi customer-web va POS'ning javoblarni o'qishini
   * bloklab qo'yardi. Header'ni butunlay o'chirish o'rniga uni to'g'ri
   * qiymatga qo'yamiz — ruxsat qaysi origin'ga berilishini CORS ro'yxati
   * hal qiladi.
   */
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

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

  /*
   * API hujjati — faqat ATAYLAB yoqilganda.
   *
   * `SWAGGER_ENABLED` default'i `false` va ishlab chiqarishda shunday
   * qolishi kerak: hujjat ichki endpoint tuzilishini ochib beradi.
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

  // `BACKEND_HOST` berilmasa Nest o'z default'ida tinglaydi.
  if (host) {
    await app.listen(port, host);
  } else {
    await app.listen(port);
  }
}

void bootstrap();
