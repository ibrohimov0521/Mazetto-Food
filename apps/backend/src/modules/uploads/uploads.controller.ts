import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MinioService,
} from "./minio.service";

/*
 * Rasm yuklash (7-bosqich Q4).
 *
 * `MENU_EDIT` ostida: rasm yuklash katalogni tahrirlashning bir qismi va
 * uni alohida huquqqa ajratish rol matritsasiga qiymat qo'shmasdi.
 */
@Controller("uploads")
export class UploadsController {
  constructor(private readonly minio: MinioService) {}

  @Post("image")
  @Permissions(PERMISSIONS.MENU_EDIT)
  // Xotirada saqlaymiz: fayl 5 MB dan kichik va darhol MinIO'ga uzatiladi,
  // ya'ni diskda vaqtinchalik nusxa qoldirishning ma'nosi yo'q.
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
          // MIME tekshiruvi fayl NOMIGA emas, yuborilgan turga qaraydi.
          new FileTypeValidator({ fileType: new RegExp(`^(${ACCEPTED_IMAGE_MIME_TYPES.join("|")})$`) }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Query("folder") folder?: string,
  ) {
    // Papka nomi mijozdan keladi, shuning uchun oq ro'yxat: aks holda
    // `../` bilan bucket ichida boshqa joyga yozish mumkin bo'lardi.
    const target = folder === "categories" || folder === "homepage" ? folder : "products";

    return this.minio.uploadImage(file, target);
  }
}
