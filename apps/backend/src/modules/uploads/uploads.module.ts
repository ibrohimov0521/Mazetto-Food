import { Module } from "@nestjs/common";
import { MinioService } from "./minio.service";
import { UploadsController } from "./uploads.controller";

@Module({
  controllers: [UploadsController],
  providers: [MinioService],
  exports: [MinioService],
})
export class UploadsModule {}
