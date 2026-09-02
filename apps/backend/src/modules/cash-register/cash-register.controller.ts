import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CloseShiftDto,
  CreateCashTransactionDto,
  OpenShiftDto,
} from "../shifts/dto/shift.dto";
import { CashRegisterService } from "./cash-register.service";

@Controller("cash-register")
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Get("shift")
  @Permissions(PERMISSIONS.SHIFT_VIEW_OWN)
  getCurrentShift(@CurrentUser() user: AuthenticatedUser) {
    return this.cashRegisterService.getCurrentShift(user);
  }

  @Post("shift/open")
  @Permissions(PERMISSIONS.SHIFT_OPEN)
  openShift(@Body() dto: OpenShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cashRegisterService.openShift(dto, user);
  }

  @Post("shift/:id/close")
  @Permissions(PERMISSIONS.SHIFT_CLOSE)
  closeShift(
    @Param("id") id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.closeShift(id, dto, user);
  }

  @Get("shift/:id/transactions")
  @Permissions(PERMISSIONS.SHIFT_VIEW_OWN)
  getTransactions(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.getTransactions(id, user);
  }

  @Post("shift/:id/transactions")
  @Permissions(PERMISSIONS.CASH_TRANSACTION_CREATE)
  createTransaction(
    @Param("id") id: string,
    @Body() dto: CreateCashTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.createCashTransaction(id, dto, user);
  }
}
