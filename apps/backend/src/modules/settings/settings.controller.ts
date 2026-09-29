import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequest } from "../../common/types/authenticated-user";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { requireTrustedTenantId } from "../../common/tenant/require-trusted-tenant";
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
  getPublicSettings(@Req() request: AuthenticatedRequest) {
    return this.settingsService.getPublicSettings(
      requireTrustedTenantId(request.tenantContext),
    );
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
  listSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.listSettings(user);
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
