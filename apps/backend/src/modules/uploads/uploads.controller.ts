import {
  Controller,
  FileTypeValidator,
  ForbiddenException,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PERMISSIONS } from "../../common/auth/permissions";
import { hasPermission } from "../../common/auth/authorization";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PermissionsAny } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MinioService,
} from "./minio.service";

/*
 * Rasm yuklash (7-bosqich Q4).
 *
 * Papka maqsadi ruxsatni belgilaydi: homepage boshqaruvchisi katalogni
 * tahrirlash huquqisiz ham reklama rasmini yuklay oladi.
 */
@Controller("uploads")
export class UploadsController {
  constructor(private readonly minio: MinioService) {}

  @Post("image")
  @PermissionsAny(PERMISSIONS.MENU_EDIT, PERMISSIONS.HOMEPAGE_MANAGE)
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
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const target = folder || "products";
    if (!(["products", "categories", "homepage"] as const).includes(target as never)) {
      throw new ForbiddenException("Upload folder is not allowed");
    }
    const requiredPermission = target === "homepage"
      ? PERMISSIONS.HOMEPAGE_MANAGE
      : PERMISSIONS.MENU_EDIT;
    if (!hasPermission(user, requiredPermission)) {
      throw new ForbiddenException("Missing upload permission for this folder");
    }

    return this.minio.uploadImage(file, target as "products" | "categories" | "homepage");
  }
}
