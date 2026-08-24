import { Body, Controller, Post } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CreatePaymentDto,
  ProcessOrderPaymentDto,
} from "./dto/create-payment.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Permissions(PERMISSIONS.PAYMENT_CREATE)
  createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.createPayment(dto, user);
  }

  @Post("process")
  @Permissions(PERMISSIONS.PAYMENT_CREATE)
  processPayment(
    @Body() dto: ProcessOrderPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.processOrderPayment(dto, user);
  }
}
