import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { PERMISSIONS } from "../../common/auth/permissions";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { ListMenuDto } from "./dto/list-menu.dto";
import {
  CreateCategoryDto,
  CreateModifierDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from "./dto/menu-management.dto";
import { MenuService } from "./menu.service";

@Controller("menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get("categories")
  @Permissions(PERMISSIONS.MENU_VIEW)
  listCategories(@Query() query: ListMenuDto) {
    return this.menuService.listCategories(query);
  }

  @Post("categories")
  @Permissions(PERMISSIONS.MENU_CREATE)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Patch("categories/:id")
  @Permissions(PERMISSIONS.MENU_EDIT)
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.menuService.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @Permissions(PERMISSIONS.MENU_DELETE)
  deleteCategory(@Param("id") id: string) {
    return this.menuService.deleteCategory(id);
  }

  @Get("products")
  @Permissions(PERMISSIONS.MENU_VIEW)
  listProducts(@Query() query: ListMenuDto) {
    return this.menuService.listProducts(query);
  }

  @Get("products/:id")
  @Permissions(PERMISSIONS.MENU_VIEW)
  getProduct(@Param("id") id: string) {
    return this.menuService.getProduct(id);
  }

  @Post("products")
  @Permissions(PERMISSIONS.MENU_CREATE)
  createProduct(@Body() dto: CreateProductDto) {
    return this.menuService.createProduct(dto);
  }

  @Patch("products/:id")
  @Permissions(PERMISSIONS.MENU_EDIT)
  updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.menuService.updateProduct(id, dto);
  }

  @Delete("products/:id")
  @Permissions(PERMISSIONS.MENU_DELETE)
  deleteProduct(@Param("id") id: string) {
    return this.menuService.deleteProduct(id);
  }

  @Post("modifiers")
  @Permissions(PERMISSIONS.MENU_CREATE)
  createModifier(@Body() dto: CreateModifierDto) {
    return this.menuService.createModifier(dto);
  }
}
