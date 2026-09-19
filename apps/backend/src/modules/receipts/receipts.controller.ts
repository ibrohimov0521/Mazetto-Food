import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ListReceiptsDto } from "./dto/list-receipts.dto";
import { ReceiptsService } from "./receipts.service";

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  @Permissions(PERMISSIONS.RECEIPT_VIEW)
  listReceipts(
    @Query() query: ListReceiptsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receiptsService.listReceipts(query, user);
  }

  @Get("order/:orderId")
  @Permissions(PERMISSIONS.RECEIPT_VIEW)
  getReceiptByOrder(
    @Param("orderId") orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receiptsService.getReceiptByOrder(orderId, user);
  }

  @Post("print-jobs/claim")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  claimPrintJob(@Query("branchId") branchId: string | undefined, @Body("agentId") agentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.claimPrintJob(branchId, agentId, user);
  }

  @Post("print-jobs/:id/complete")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  completePrintJob(@Param("id") id: string, @Body("leaseToken") leaseToken: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.completePrintJob(id, leaseToken, user);
  }

  @Post("print-jobs/:id/fail")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  failPrintJob(@Param("id") id: string, @Body() body: { leaseToken: string; error: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.failPrintJob(id, body.leaseToken, body.error || "Unknown printer failure", user);
  }
  @Get(":id")
  @Permissions(PERMISSIONS.RECEIPT_VIEW)
  getReceipt(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.getReceipt(id, user);
  }

  @Patch(":id/print")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  markPrinted(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.markPrinted(id, user);
  }
}
