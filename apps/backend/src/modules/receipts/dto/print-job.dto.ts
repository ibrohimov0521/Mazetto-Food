import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class ClaimPrintJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  agentId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  printerIds?: string[];

  @IsOptional()
  @IsBoolean()
  acceptUnassigned?: boolean;
}

export class CompletePrintJobDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  leaseToken!: string;
}

export class FailPrintJobDto extends CompletePrintJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;
}
const printJobStatuses = ["PENDING", "PROCESSING", "PRINTED", "DEAD_LETTER", "CANCELLED"] as const;

export class ListPrintJobsDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsIn(printJobStatuses)
  status?: (typeof printJobStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
