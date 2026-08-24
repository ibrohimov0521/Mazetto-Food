import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

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
  @IsString()
  @MaxLength(500)
  reason?: string;
}
