import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as Minio from "minio";

/*
 * Media saqlash (7-bosqich Q4).
 *
 * MUAMMO. Mahsulot rasmi admin panelda ODDIY MATN maydoni edi
 * (`admin-product-editor.tsx`): admin yo'lni qo'lda yozardi, faylni esa
 * serverga alohida joylashtirish kerak bo'lardi. AUD-009 ("ishlab chiqarish
 * media volume'i bo'sh") aynan shundan: qator bazada bor edi, fayl serverga
 * hech qachon chiqmagan.
 *
 * NIMA UCHUN MinIO, oddiy disk emas: u S3 API beradi, alohida servis
 * sifatida backup qilinadi va bir nechta backend instance bir xil fayllarni
 * ko'radi. Konteyner ichidagi papka bularning uchalasini ham bermaydi.
 */

/*
 * Qabul qilinadigan MIME turlari va ularning kengaytmasi.
 *
 * Kengaytmani FAYL NOMIDAN olmaymiz: uni yuklovchi tanlaydi va u mazmun
 * bilan mos kelishi shart emas. MIME kontroller tomonidan tekshiriladi,
 * bu jadval esa faqat tekshirilganini nomga o'giradi.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ACCEPTED_IMAGE_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

/** 5 MB — mahsulot rasmi uchun keng, lekin cheksiz emas. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET?.trim() || "mazetto-media";
    this.publicUrl = (process.env.MINIO_PUBLIC_URL?.trim() || "").replace(/\/+$/, "");

    const endPoint = process.env.MINIO_ENDPOINT?.trim();
    const accessKey = process.env.MINIO_ROOT_USER?.trim();
    const secretKey = process.env.MINIO_ROOT_PASSWORD?.trim();

    if (!endPoint || !accessKey || !secretKey) {
      // Sozlanmagan bo'lsa ilova ISHLAYVERADI — faqat yuklash endpointi
      // xato qaytaradi. Media sozlamasi butun backendni to'xtatishga
      // arzimaydi (Redis bilan bir xil mulohaza).
      this.logger.warn("MinIO sozlanmagan — rasm yuklash o'chiq");
      this.client = null;
      return;
    }

    this.client = new Minio.Client({
      endPoint,
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL?.trim().toLowerCase() === "true",
      accessKey,
      secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const exists = await this.client.bucketExists(this.bucket);

      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket yaratildi: ${this.bucket}`);
      }

      /*
       * Bucket'ni ANONIM O'QISH uchun ochamiz.
       *
       * Mahsulot rasmlari mijoz saytida ko'rinadi, ya'ni ular allaqachon
       * ommaviy. Har rasm uchun imzolangan URL berish keshni buzardi va
       * mijoz sahifasini sekinlashtirardi. YOZISH esa faqat backend
       * kalitlari bilan mumkin bo'lib qoladi.
       */
      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }),
      );
    } catch (error) {
      this.logger.warn(
        `MinIO tayyorlanmadi: ${error instanceof Error ? error.message : "noma'lum xato"}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Rasmni saqlaydi va uni O'QISH uchun public URL qaytaradi.
   *
   * Fayl nomi UUID dan yasaladi, yuklangan nomdan emas: original nom
   * boshqa fayl ustiga yozishi, yo'l belgilarini olib kirishi yoki
   * mijozning shaxsiy ma'lumotini ochib qo'yishi mumkin.
   */
  async uploadImage(
    file: { buffer: Buffer; mimetype: string; size: number },
    folder: string,
  ): Promise<{ url: string; objectName: string }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Media saqlash sozlanmagan — MINIO_* qiymatlarini tekshiring",
      );
    }

    const extension = EXTENSION_BY_MIME[file.mimetype];

    if (!extension) {
      // Kontroller buni allaqachon rad etgan; bu ikkinchi himoya qatlami.
      throw new ServiceUnavailableException("Qo'llab-quvvatlanmaydigan rasm turi");
    }

    const objectName = `${folder}/${randomUUID()}.${extension}`;

    await this.client.putObject(this.bucket, objectName, file.buffer, file.size, {
      "Content-Type": file.mimetype,
      // Fayl nomi UUID, ya'ni mazmuni hech qachon o'zgarmaydi — uzoq kesh
      // xavfsiz va mijoz sahifasini sezilarli tezlashtiradi.
      "Cache-Control": "public, max-age=31536000, immutable",
    });

    return {
      objectName,
      url: `${this.publicUrl}/${objectName}`,
    };
  }
}
