import {
  Body,
  Controller,
  Delete,
  Put,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import {
  ListCustomerOrdersDto,
  ListCustomersDto,
  ListOnlineOrdersDto,
  AssignCourierDto,
  UpdateCourierOrderStatusDto,
} from "./dto/list-customers.dto";
import { CurrentCustomer } from "../../common/decorators/current-customer.decorator";
import { CustomerAuth } from "../../common/decorators/customer-auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedCustomer } from "../../common/types/authenticated-customer";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  CustomerCheckoutQuoteDto,
  CreateOnlineOrderDto,
  CustomerLogoutDto,
  CustomerRefreshDto,
  CustomerRequestCodeDto,
  CustomerVerifyCodeDto,
} from "./dto/customer.dto";
import { CustomersService } from "./customers.service";
import { CustomerAddressesService } from "./customer-addresses.service";
import { SaveCustomerAddressDto } from "./dto/delivery-location.dto";

@Controller("customer")
export class CustomerPublicController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly addressesService: CustomerAddressesService,
  ) {}

  @CustomerAuth()
  @Get("me/addresses")
  listAddresses(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.addressesService.list(customer.id);
  }

  @CustomerAuth()
  @Put("me/addresses/:id")
  saveAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id") id: string,
    @Body() dto: SaveCustomerAddressDto,
  ) {
    return this.addressesService.save(customer.id, id, dto);
  }

  @CustomerAuth()
  @Delete("me/addresses/:id")
  deleteAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id") id: string,
  ) {
    return this.addressesService.remove(customer.id, id);
  }

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

  @CustomerAuth()
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

  @CustomerAuth()
  @Post("checkout/quote")
  quoteCheckout(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CustomerCheckoutQuoteDto,
  ) {
    return this.customersService.quoteCheckout(customer.id, dto);
  }

  @CustomerAuth()
  @Post("orders")
  createOnlineOrder(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: CreateOnlineOrderDto,
  ) {
    return this.customersService.createOnlineOrder(customer.id, dto);
  }

  @CustomerAuth()
  @Get("me/dashboard")
  getDashboard(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customersService.getCustomerDashboard(customer.id);
  }

  @CustomerAuth()
  @Get("me/orders")
  listOrders(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query() query: ListCustomerOrdersDto,
  ) {
    return this.customersService.listCustomerOrders(customer.id, query);
  }

  @CustomerAuth()
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
  listCustomers(
    @Query() query: ListCustomersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.listCustomers(query, user);
  }

  @Get("customers/statistics")
  @Permissions(PERMISSIONS.CUSTOMER_VIEW)
  getCustomerStats(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.getCustomerStats(user);
  }

  @Get("online-orders")
  @Permissions(PERMISSIONS.ONLINE_ORDER_VIEW)
  listOnlineOrders(
    @Query() query: ListOnlineOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.listOnlineOrders(query, user);
  }

  @Get("courier/orders")
  @Permissions(PERMISSIONS.COURIER_DELIVERY_VIEW)
  listCourierOrders(
    @Query() query: ListOnlineOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.listCourierDeliveryOrders(query, user);
  }

  @Get("courier/orders/history")
  @Permissions(PERMISSIONS.COURIER_DELIVERY_VIEW)
  listCourierOrderHistory(
    @Query() query: ListOnlineOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.listCourierDeliveryOrderHistory(query, user);
  }

  /*
   * Kuryerlar nazorati (5.5). `COURIER_MANAGE` — KURYERGA BERILMAGAN:
   * kuryer o'z buyurtmasini oladi, lekin boshqasinikini tortib ololmaydi.
   */
  @Get("couriers")
  @Permissions(PERMISSIONS.COURIER_MANAGE)
  listCouriers(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.listCouriers(user);
  }

  @Get("couriers/deliveries")
  @Permissions(PERMISSIONS.COURIER_MANAGE)
  listActiveDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.listActiveDeliveries(user);
  }

  @Patch("courier/orders/:id/assign")
  @Permissions(PERMISSIONS.COURIER_MANAGE)
  assignCourier(
    @Param("id") id: string,
    @Body() dto: AssignCourierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.assignCourier(id, dto.employeeId, user);
  }

  @Patch("courier/orders/:id/status")
  @Permissions(PERMISSIONS.COURIER_DELIVERY_UPDATE)
  updateCourierOrderStatus(
    @Param("id") id: string,
    @Body() dto: UpdateCourierOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.updateCourierOrderStatus(id, dto, user);
  }
}
