import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import {
  HomepageHeroSlideDto,
  PromotionDto,
  UpdateHomepageHeroSlideDto,
  UpdatePromotionDto,
} from "./dto/homepage.dto";
import { HomepageService } from "./homepage.service";

@Controller("customer/home")
export class CustomerHomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Public()
  @Get()
  getHome(@Query("branchId") branchId?: string) {
    return this.homepageService.getCustomerHome(branchId);
  }
}

@Controller("homepage")
export class HomepageAdminController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get("hero-slides")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  listHeroSlides() {
    return this.homepageService.listHeroSlides();
  }

  @Post("hero-slides")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  createHeroSlide(@Body() dto: HomepageHeroSlideDto) {
    return this.homepageService.createHeroSlide(dto);
  }

  @Patch("hero-slides/:id")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  updateHeroSlide(
    @Param("id") id: string,
    @Body() dto: UpdateHomepageHeroSlideDto,
  ) {
    return this.homepageService.updateHeroSlide(id, dto);
  }

  @Delete("hero-slides/:id")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  deleteHeroSlide(@Param("id") id: string) {
    return this.homepageService.deleteHeroSlide(id);
  }

  @Get("promotions")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  listPromotions() {
    return this.homepageService.listPromotions();
  }

  @Post("promotions")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  createPromotion(@Body() dto: PromotionDto) {
    return this.homepageService.createPromotion(dto);
  }

  @Patch("promotions/:id")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  updatePromotion(@Param("id") id: string, @Body() dto: UpdatePromotionDto) {
    return this.homepageService.updatePromotion(id, dto);
  }

  @Delete("promotions/:id")
  @Permissions(PERMISSIONS.HOMEPAGE_MANAGE)
  deletePromotion(@Param("id") id: string) {
    return this.homepageService.deletePromotion(id);
  }
}
