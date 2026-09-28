export type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  roles: string[];
  permissions: string[];
};

export type AuthSession = { user: AuthUser; accessToken: string };

export type Probe = {
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string | null;
  error: string | null;
};

export type Kitchen = {
  branchId: string;
  name: string;
  status: "OPEN" | "CLOSED";
  openOrders: number;
  kitchenQueue: number;
  onlineDevices: number;
  offlineDevices: number;
  lastActivityAt: string | null;
  deviceVersions?: Array<{ deviceType: string; version: string; total: number; online: number; offline: number }>;
};

export type Heartbeat = {
  version: string;
  buildId?: string;
  status: "healthy" | "degraded";
  services: { backend: string; database: string; redis: string };
  totals: {
    branchCount: number;
    openOrders: number;
    kitchenQueue: number;
    onlineDevices: number;
    offlineDevices: number;
    deadPrintJobs: number;
  };
  lastActivityAt: string | null;
  kitchens: Kitchen[];
  backup?: {
    status: "verified" | "stale" | "unavailable" | "not_configured";
    verifiedAt: string | null;
    bytes: number | null;
    archiveEntries: number | null;
    restoreTested: boolean;
  };
};

export type Site = {
  id: string;
  siteKey: string;
  tenantId: string | null;
  name: string;
  productCode: string;
  websiteUrl: string;
  apiHealthUrl: string;
  isActive: boolean;
  agentStatus: "ONLINE" | "DEGRADED" | "OFFLINE" | "WAITING" | "DISABLED";
  lastHeartbeatAt: string | null;
  heartbeat: Heartbeat | null;
  website: Probe;
  api: Probe;
};

export type SiteEvent = {
  id: string;
  siteId: string;
  code: string;
  branchId?: string | null;
  branchName?: string | null;
  occurredAt: string;
  receivedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedById?: string | null;
  acknowledgedBy?: { displayName: string | null; email: string | null; phone: string | null } | null;
};

export type GlobalSiteEvent = SiteEvent & { site: { name: string; productCode: string } };

export type PlatformDiagnostic = {
  id: string;
  siteId: string;
  externalId: string;
  service: "backend" | "database" | "redis" | "control_plane";
  code: "LOCAL_HEARTBEAT_BUILD_FAILED" | "CONTROL_PLANE_REJECTED_HEARTBEAT" | "CONTROL_PLANE_UNREACHABLE";
  severity: "warning" | "error";
  occurredAt: string;
  receivedAt: string;
  site: { name: string; productCode: string };
};

export type PlatformAuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; displayName: string | null; email: string | null; phone: string | null } | null;
};

export type PlatformAuditPage = { entries: PlatformAuditEntry[]; hasNext: boolean };

export type PlatformReportDay = {
  day: string;
  completedOrders: number;
  cancelledOrders: number;
  completedOrderTotal: number;
};

export type PlatformReportSite = {
  siteId: string;
  name: string;
  productCode: string;
  lastHeartbeatAt: string | null;
  stale: boolean;
  reports: PlatformReportDay[];
};

export type PlatformReports = {
  days: 7 | 14;
  timezone: string;
  daily: PlatformReportDay[];
  sites: PlatformReportSite[];
  generatedAt: string;
};

export type PlatformHealth = { service: string; status: string; database: { status: string }; redis: "connected" | "fallback" };

export type ProvisionedAgent = { site: Site; agentToken: string };


export type TenantRegistryEntry = {
  id: string;
  code: string;
  name: string;
  status: "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  branches: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    isTemporarilyClosed: boolean;
    acceptsOrders: boolean;
  }>;
  activity?: {
    activeBranches: number;
    acceptingOrdersBranches: number;
    openOrders: number;
    onlineDevices: number;
    offlineDevices: number;
  };
  platformSites: Array<{
    id: string;
    name: string;
    productCode: string;
    isActive: boolean;
    agentStatus: Site["agentStatus"];
    lastHeartbeatAt: string | null;
    website: { status: Probe["status"]; checkedAt: string | null };
    api: { status: Probe["status"]; checkedAt: string | null };
  }>;
  domains: Array<{
    id: string;
    hostname: string;
    status: "PENDING" | "VERIFIED" | "DISABLED";
    verifiedAt: string | null;
  }>;
};


export type TenantMembershipRole = {
  role: { id: string; code: string; name: string; isBranchScoped: boolean };
};

export type TenantMembership = {
  id: string;
  tenantId: string;
  userId: string;
  branchId: string | null;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string | null; email: string | null; phone: string | null; isActive: boolean };
  branch: { id: string; code: string; name: string } | null;
  roles: TenantMembershipRole[];
};

export type TenantRoleOption = {
  id: string;
  code: string;
  name: string;
  isBranchScoped: boolean;
};
