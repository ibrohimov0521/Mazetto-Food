import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CloseShiftDto,
  CreateCashTransactionDto,
  CreateCashTransferDto,
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

  @Get("shift/orders")
  @Permissions(PERMISSIONS.SHIFT_VIEW_OWN)
  getCurrentShiftOrders(
    @Query()
    query: {
      status?: string;
      search?: string;
      limit?: string;
      offset?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.getCurrentShiftOrders(query, user);
  }

  @Get("courier-shift")
  @Permissions(PERMISSIONS.SHIFT_VIEW_OWN)
  getCourierShift(@CurrentUser() user: AuthenticatedUser) {
    return this.cashRegisterService.getCourierShift(user);
  }

  @Post("courier-shift/open")
  @Permissions(PERMISSIONS.SHIFT_OPEN)
  openCourierShift(
    @Body() dto: OpenShiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.openCourierShift(dto, user);
  }

  @Post(["transfers", "courier-shift/transfers"])
  @Permissions(PERMISSIONS.CASH_TRANSACTION_CREATE)
  createCashTransfer(
    @Body() dto: CreateCashTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.createCashTransfer(dto, user);
  }

  @Get("transfers/pending")
  @Permissions(PERMISSIONS.CASH_TRANSACTION_CREATE)
  listPendingTransfers(@CurrentUser() user: AuthenticatedUser) {
    return this.cashRegisterService.listPendingTransfers(user);
  }

  @Post("transfers/:id/accept")
  @Permissions(PERMISSIONS.CASH_TRANSACTION_CREATE)
  acceptTransfer(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.acceptTransfer(id, user);
  }

  @Post("transfers/:id/reject")
  @Permissions(PERMISSIONS.CASH_TRANSACTION_CREATE)
  rejectTransfer(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cashRegisterService.rejectTransfer(id, body.reason, user);
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
