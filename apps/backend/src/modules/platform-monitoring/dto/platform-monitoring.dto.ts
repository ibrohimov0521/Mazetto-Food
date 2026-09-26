import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

const serviceStates = ["ok", "degraded", "error"] as const;
const eventCodes = [
  "ORDER_CREATED",
  "ORDER_STATUS_CHANGED",
  "KITCHEN_TICKET_CHANGED",
  "DEVICE_DISCONNECTED",
  "PRINTER_FAILED",
] as const;

export class CreatePlatformSiteDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(32)
  productCode = "MAZETTO_FOOD";

  @IsString()
  @MaxLength(2048)
  websiteUrl!: string;

  @IsString()
  @MaxLength(2048)
  apiHealthUrl!: string;
}

export class UpdatePlatformSiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  productCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  apiHealthUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PlatformHeartbeatServicesDto {
  @IsIn(serviceStates)
  backend!: (typeof serviceStates)[number];

  @IsIn(serviceStates)
  database!: (typeof serviceStates)[number];

  @IsIn(serviceStates)
  redis!: (typeof serviceStates)[number];
}

export class PlatformHeartbeatTotalsDto {
  @IsInt()
  @Min(0)
  @Max(10000)
  branchCount!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  openOrders!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  kitchenQueue!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  onlineDevices!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  offlineDevices!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  deadPrintJobs!: number;
}

export class PlatformKitchenSnapshotDto {
  @IsString()
  @MaxLength(80)
  branchId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(["OPEN", "CLOSED"])
  status!: "OPEN" | "CLOSED";

  @IsInt()
  @Min(0)
  @Max(1000000)
  openOrders!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  kitchenQueue!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  onlineDevices!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  offlineDevices!: number;

  @IsOptional()
  @IsDateString()
  lastActivityAt?: string | null;
}

export class PlatformHeartbeatEventDto {
  @IsString()
  @MaxLength(120)
  id!: string;

  @IsIn(eventCodes)
  code!: (typeof eventCodes)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  branchName?: string;

  @IsDateString()
  occurredAt!: string;
}

export class PlatformDailyReportDto {
  @IsDateString()
  day!: string;

  @IsInt()
  @Min(0)
  @Max(10000000)
  completedOrders!: number;

  @IsInt()
  @Min(0)
  @Max(10000000)
  cancelledOrders!: number;

  @IsString()
  @Matches(/^\d{1,14}(\.\d{1,2})?$/)
  completedOrderTotal!: string;
}

export class PlatformBackupSummaryDto {
  @IsIn(["verified", "stale", "unavailable", "not_configured"])
  status!: "verified" | "stale" | "unavailable" | "not_configured";

  @IsOptional()
  @IsDateString()
  verifiedAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  bytes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  archiveEntries?: number | null;

  @IsBoolean()
  restoreTested!: boolean;
}

const diagnosticCodes = [
  "LOCAL_HEARTBEAT_BUILD_FAILED",
  "CONTROL_PLANE_REJECTED_HEARTBEAT",
  "CONTROL_PLANE_UNREACHABLE",
] as const;

export class PlatformDiagnosticDto {
  @IsString()
  @MaxLength(120)
  id!: string;

  @IsIn(["backend", "database", "redis", "control_plane"])
  service!: "backend" | "database" | "redis" | "control_plane";

  @IsIn(diagnosticCodes)
  code!: (typeof diagnosticCodes)[number];

  @IsIn(["warning", "error"])
  severity!: "warning" | "error";

  @IsDateString()
  occurredAt!: string;
}

export class PlatformHeartbeatDto {
  @IsString()
  @MaxLength(40)
  version!: string;

  @IsIn(["healthy", "degraded"])
  status!: "healthy" | "degraded";

  @ValidateNested()
  @Type(() => PlatformHeartbeatServicesDto)
  services!: PlatformHeartbeatServicesDto;

  @ValidateNested()
  @Type(() => PlatformHeartbeatTotalsDto)
  totals!: PlatformHeartbeatTotalsDto;

  @IsOptional()
  @IsDateString()
  lastActivityAt?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlatformKitchenSnapshotDto)
  kitchens!: PlatformKitchenSnapshotDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlatformHeartbeatEventDto)
  events!: PlatformHeartbeatEventDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => PlatformDailyReportDto)
  dailyReports?: PlatformDailyReportDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformBackupSummaryDto)
  backup?: PlatformBackupSummaryDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlatformDiagnosticDto)
  diagnostics?: PlatformDiagnosticDto[];
}
