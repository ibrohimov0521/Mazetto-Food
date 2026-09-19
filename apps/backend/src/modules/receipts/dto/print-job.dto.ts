import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ClaimPrintJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  agentId!: string;
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