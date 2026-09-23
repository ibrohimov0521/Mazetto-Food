import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ListReceiptsDto } from "./dto/list-receipts.dto";
import { ClaimPrintJobDto, CompletePrintJobDto, FailPrintJobDto, ListPrintJobsDto } from "./dto/print-job.dto";
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

  @Get("print-jobs")
  @Permissions(PERMISSIONS.RECEIPT_VIEW)
  listPrintJobs(@Query() query: ListPrintJobsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.listPrintJobs(query, user);
  }
  @Post("print-jobs/claim")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  claimPrintJob(
    @Query("branchId") branchId: string | undefined,
    @Body() body: ClaimPrintJobDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("x-mazetto-device-id") deviceId: string | undefined,
  ) {
    return this.receiptsService.claimPrintJob(
      branchId,
      body.agentId,
      user,
      body.printerIds,
      body.acceptUnassigned,
      deviceId,
    );
  }

  @Post("print-jobs/:id/complete")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  completePrintJob(@Param("id") id: string, @Body() body: CompletePrintJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.completePrintJob(id, body.leaseToken, user);
  }

  @Post("print-jobs/:id/fail")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  failPrintJob(@Param("id") id: string, @Body() body: FailPrintJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.failPrintJob(id, body.leaseToken, body.error || "Unknown printer failure", user);
  }
  @Post("print-jobs/:id/retry")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  retryPrintJob(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.retryPrintJob(id, user);
  }
  @Delete("bulk")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  deleteReceipts(@Body() body: { ids: string[] }, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.deleteReceipts(body.ids, user);
  }
  @Post(":id/reprint")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  reprint(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receiptsService.reprintReceipt(id, user);
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
