import { Body, Controller, Param, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CloseShiftDto,
  CreateCashTransactionDto,
  OpenShiftDto,
} from "./dto/shift.dto";
import { ShiftsService } from "./shifts.service";

@Controller("shifts")
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post("open")
  @Permissions(PERMISSIONS.SHIFT_OPEN)
  openShift(@Body() dto: OpenShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.openShift(dto, user);
  }

  @Post(":id/close")
  @Permissions(PERMISSIONS.SHIFT_CLOSE)
  closeShift(
    @Param("id") id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shiftsService.closeShift(id, dto, user);
  }

  @Post(":id/cash-transactions")
  @Permissions(PERMISSIONS.CASH_TRANSACTION_CREATE)
  createCashTransaction(
    @Param("id") id: string,
    @Body() dto: CreateCashTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shiftsService.createCashTransaction(id, dto, user);
  }
}
