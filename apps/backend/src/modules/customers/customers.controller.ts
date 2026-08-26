import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { CurrentCustomer } from "../../common/decorators/current-customer.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { CustomerAuthGuard } from "../../common/guards/customer-auth.guard";
import type { AuthenticatedCustomer } from "../../common/types/authenticated-customer";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CreateOnlineOrderDto,
  CustomerLogoutDto,
  CustomerRefreshDto,
  CustomerRequestCodeDto,
  CustomerVerifyCodeDto,
} from "./dto/customer.dto";
import { CustomersService } from "./customers.service";

@Controller("customer")
export class CustomerPublicController {
  constructor(private readonly customersService: CustomersService) {}

  @Public()
  @Post("auth/request-code")
  requestCode(@Body() dto: CustomerRequestCodeDto) {
    return this.customersService.requestCode(dto);
  }

  @Public()
  @Post("auth/verify-code")
  verifyCode(@Body() dto: CustomerVerifyCodeDto) {
    return this.customersService.verifyCode(dto);
  }

  @Public()
  @Post("auth/refresh")
  refresh(@Body() dto: CustomerRefreshDto) {
    return this.customersService.refresh(dto);
  }

  @Public()
  @Post("auth/logout")
  logout(@Body() dto: CustomerLogoutDto) {
    return this.customersService.logout(dto);
  }

  @UseGuards(CustomerAuthGuard)
  @Public()
  @Get("auth/me")
  getMe(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customersService.getMe(customer.id);
  }

  @Public()
  @Get("menu/categories")
  listCategories(@Query("branchId") branchId?: string) {
    return this.customersService.listCategories(branchId);
  }

  @Public()
  @Get("branches")
  listBranches() {
    return this.customersService.listBranches();
  }

  @Public()
  @Get("menu/products")
  listProducts(
    @Query("branchId") branchId?: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.customersService.listProducts(branchId, categoryId);
  }

  @Public()
  @Get("menu/products/:id")
  getProduct(@Param("id") id: string) {
    return this.customersService.getProduct(id);
  }

  @UseGuards(CustomerAuthGuard)
  @Public()
  @Post("orders")
  createOnlineOrder(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CreateOnlineOrderDto,
  ) {
    return this.customersService.createOnlineOrder(customer.id, dto);
  }

  @UseGuards(CustomerAuthGuard)
  @Public()
  @Get("me/dashboard")
  getDashboard(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customersService.getCustomerDashboard(customer.id);
  }

  @UseGuards(CustomerAuthGuard)
  @Public()
  @Get("me/orders")
  listOrders(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customersService.listCustomerOrders(customer.id);
  }

  @UseGuards(CustomerAuthGuard)
  @Public()
  @Get("me/orders/:id")
  getOrder(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id") id: string,
  ) {
    return this.customersService.getCustomerOrder(customer.id, id);
  }
}

@Controller()
export class CustomersAdminController {
  constructor(private readonly customersService: CustomersService) {}

  @Get("customers")
  @Permissions(PERMISSIONS.CUSTOMER_VIEW)
  listCustomers(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.listCustomers(user);
  }

  @Get("customers/statistics")
  @Permissions(PERMISSIONS.CUSTOMER_VIEW)
  getCustomerStats(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.getCustomerStats(user);
  }

  @Get("online-orders")
  @Permissions(PERMISSIONS.ONLINE_ORDER_VIEW)
  listOnlineOrders(
    @Query("branchId") branchId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.listOnlineOrders(branchId, user);
  }
}
