import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  /*
   * Ota kategoriya. `Category.parentId` sxemada bor va `listCategories`
   * uni qaytaradi, lekin DTO qabul qilmagani uchun quyi kategoriyalarni
   * boshqarib bo'lmasdi.
   */
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder = 0;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  /* `null` — ota kategoriyadan ajratish (yuqori darajaga ko'tarish). */
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsBoolean()
  isDefault = false;
}

export class ProductModifierDto {
  @IsString()
  modifierId!: string;

  /*
   * GURUH SOZLAMALARI.
   *
   * `ProductModifier` jadvali bu maydonlarni SAQLAYDI va
   * `GET /menu/products/:id` ularni QAYTARADI, lekin DTO ularni qabul
   * qilmagani uchun admin paneldan o'zgartirib bo'lmasdi — mahsulot
   * saqlanganda hammasi standart qiymatga tushib ketardi.
   *
   * Yuborilmasa, mavjud qiymat o'zgarmaydi (qarang `menu.service`).
   */
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  minSelect?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxSelect?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class CreateProductDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  categoryId!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preparationTime?: number;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductModifierDto)
  modifiers?: ProductModifierDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preparationTime?: number;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductModifierDto)
  modifiers?: ProductModifierDto[];
}

export class CreateModifierDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  /*
   * `description`, `sortOrder` va `isActive` YARATISHDA ham qabul
   * qilinadi. Ilgari faqat nom va narx olinardi, ya'ni admin panel
   * har yangi modifikatordan keyin ikkinchi PATCH yuborishga majbur
   * bo'lardi — va shu ikki so'rov orasida modifikator noto'g'ri
   * tartibda ko'rinardi.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateModifierDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  /* `Modifier.description` sxemada bor, lekin DTO uni qabul qilmasdi. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
