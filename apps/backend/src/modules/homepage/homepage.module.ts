import { Module } from "@nestjs/common";
import {
  CustomerHomepageController,
  HomepageAdminController,
} from "./homepage.controller";
import { HomepageService } from "./homepage.service";

@Module({
  controllers: [CustomerHomepageController, HomepageAdminController],
  providers: [HomepageService],
})
export class HomepageModule {}
