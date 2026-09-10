import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

/*
 * Global: sozlamalar buyurtma, auth va Telegram yo'llarida o'qiladi, ya'ni
 * har modulga alohida import qilish faqat shovqin qo'shardi.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
