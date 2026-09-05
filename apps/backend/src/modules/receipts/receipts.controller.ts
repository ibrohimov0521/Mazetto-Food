import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
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
