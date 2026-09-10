import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

// Global: cheklov, kesh va (keyinchalik) geokodlash proxysi undan
// foydalanadi, ya'ni har modulga alohida import qilish ortiqcha shovqin.
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
