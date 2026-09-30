import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export enum PosOrderStatus {
  NEW = "NEW",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  READY = "READY",
  SERVED = "SERVED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export class UpdateOrderStatusDto {
  @IsEnum(PosOrderStatus)
  status!: PosOrderStatus;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}

export class BulkUpdateOrderStatusDto extends UpdateOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  orderIds!: string[];

  @IsBoolean()
  confirm!: boolean;
}
