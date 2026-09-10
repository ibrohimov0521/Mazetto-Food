import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { UpdateSettingDto } from "./dto/update-setting.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /*
   * Mijoz tomoni uchun ochiq qism.
   *
   * Mijoz to'lov usullarini yoki yetkazish mavjudligini O'ZI hal qilmaydi —
   * server yagona manba. Ilgari bu qiymatlar frontendda qattiq yozilgan edi
   * va serverdagi haqiqat bilan uzilib qolishi mumkin edi.
   */
  @Public()
  @Get("public")
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  /*
   * Sozlamalarni faqat SUPER_ADMIN boshqaradi.
   *
   * Bular kill switch va cheklov qiymatlari, ya'ni filial menejeri
   * darajasidagi qaror emas.
   */
  @Get()
  @Roles("SUPER_ADMIN")
  @Permissions(PERMISSIONS.SETTING_MANAGE)
  listSettings() {
    return this.settingsService.listSettings();
  }

  @Patch(":key")
  @Roles("SUPER_ADMIN")
  @Permissions(PERMISSIONS.SETTING_MANAGE)
  updateSetting(
    @Param("key") key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSetting(key, dto.value, user);
  }
}
