import { IsBooleanString, IsOptional, IsString } from "class-validator";

export class ListMenuDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBooleanString()
  recommended?: string;
}
