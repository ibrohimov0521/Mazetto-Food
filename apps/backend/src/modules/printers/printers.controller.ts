import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreatePrinterDto, UpdatePrinterDto } from "./dto/printer.dto";
import { PrintersService } from "./printers.service";

@Controller("printers")
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  listPrinters(
    @Query("branchId") branchId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.printersService.listPrinters(branchId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  createPrinter(
    @Body() dto: CreatePrinterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.printersService.createPrinter(dto, user);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.RECEIPT_PRINT)
  updatePrinter(
    @Param("id") id: string,
    @Body() dto: UpdatePrinterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.printersService.updatePrinter(id, dto, user);
  }
}
