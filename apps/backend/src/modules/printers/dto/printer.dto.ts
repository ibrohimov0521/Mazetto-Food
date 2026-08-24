import { PrinterStatus, PrinterType } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePrinterDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(PrinterType)
  type!: PrinterType;

  @IsOptional()
  @IsEnum(PrinterStatus)
  status?: PrinterStatus;
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(PrinterType)
  type?: PrinterType;

  @IsOptional()
  @IsEnum(PrinterStatus)
  status?: PrinterStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
