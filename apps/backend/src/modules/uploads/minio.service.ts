import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as Minio from "minio";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DEFAULT_MEDIA_UPLOAD_URLS = [
  "http://mazetto-food-media:80/__upload",
  "http://mazetto-food-media-btinws:80/__upload",
];

export const ACCEPTED_IMAGE_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly mediaUploadUrls: string[];

  constructor() {
    this.bucket = process.env.MINIO_BUCKET?.trim() || "mazetto-media";
    this.publicUrl = (
      process.env.MEDIA_PUBLIC_URL?.trim() ||
      process.env.MINIO_PUBLIC_URL?.trim() ||
      "https://media.mazettofood.uz"
    ).replace(//+$/, "");

    const configuredUploadUrl = process.env.MEDIA_UPLOAD_URL?.trim();
    this.mediaUploadUrls = configuredUploadUrl
      ? [configuredUploadUrl.replace(//+$/, "")]
      : DEFAULT_MEDIA_UPLOAD_URLS;

    const endPoint = process.env.MINIO_ENDPOINT?.trim();
    const accessKey = process.env.MINIO_ROOT_USER?.trim();
    const secretKey = process.env.MINIO_ROOT_PASSWORD?.trim();

    if (!endPoint || !accessKey || !secretKey) {
      this.logger.warn(
        "MinIO sozlanmagan - ichki media servisiga yozish fallbacki ishlatiladi",
      );
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
    if (!this.client) return;

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log("Bucket yaratildi: " + this.bucket);
      }

      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: ["arn:aws:s3:::" + this.bucket + "/*"],
          }],
        }),
      );
    } catch (error) {
      this.logger.warn(
        "MinIO tayyorlanmadi: " +
          (error instanceof Error ? error.message : "noma'lum xato"),
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null || this.mediaUploadUrls.length > 0;
  }

  async uploadImage(
    file: { buffer: Buffer; mimetype: string; size: number },
    folder: string,
  ): Promise<{ url: string; objectName: string }> {
    const extension = EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      throw new ServiceUnavailableException("Qo'llab-quvvatlanmaydigan rasm turi");
    }

    const objectName = folder + "/" + randomUUID() + "." + extension;

    if (this.client) {
      try {
        await this.client.putObject(this.bucket, objectName, file.buffer, file.size, {
          "Content-Type": file.mimetype,
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        return { objectName, url: this.publicUrl + "/" + objectName };
      } catch (error) {
        this.logger.warn(
          "MinIO ga yozib bo'lmadi, media fallback sinab ko'riladi: " +
            (error instanceof Error ? error.message : "noma'lum xato"),
        );
      }
    }

    await this.uploadToMediaService(file, objectName);
    return { objectName, url: this.publicUrl + "/" + objectName };
  }

  private async uploadToMediaService(
    file: { buffer: Buffer; mimetype: string; size: number },
    objectName: string,
  ): Promise<void> {
    let lastProblem = "media servisi topilmadi";

    for (const baseUrl of this.mediaUploadUrls) {
      try {
        const response = await fetch(baseUrl + "/" + objectName, {
          method: "PUT",
          headers: {
            "Content-Type": file.mimetype,
            "Content-Length": String(file.size),
          },
          body: file.buffer,
          signal: AbortSignal.timeout(15_000),
        });

        if (response.ok) return;
        lastProblem = "HTTP " + response.status;
      } catch (error) {
        lastProblem =
          error instanceof Error ? error.message : "noma'lum tarmoq xatosi";
      }
    }

    this.logger.error("Media servisiga rasm yozilmadi: " + lastProblem);
    throw new ServiceUnavailableException(
      "Rasmni media serverga saqlab bo'lmadi. Qayta urinib ko'ring.",
    );
  }
}