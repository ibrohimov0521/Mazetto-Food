export type PlatformEventDraft = {
  siteId: string;
  externalId: string;
  code: string;
  occurredAt: Date;
};

type SiteHeartbeatState = {
  id: string;
  createdAt: Date;
  lastHeartbeatAt: Date | null;
  lastHeartbeatStatus: string | null;
};

type SiteProbeState = SiteHeartbeatState & {
  websiteStatus: string;
  websiteCheckedAt: Date | null;
  apiStatus: string;
  apiCheckedAt: Date | null;
};

export const heartbeatGraceMs = 3 * 60 * 1000;

export function heartbeatTransitionEvents(
  site: SiteHeartbeatState,
  status: "healthy" | "degraded",
  now: Date,
): PlatformEventDraft[] {
  const wasOffline =
    !site.lastHeartbeatAt || now.getTime() - site.lastHeartbeatAt.getTime() > heartbeatGraceMs;
  const events: PlatformEventDraft[] = [];
  const previousAt = site.lastHeartbeatAt ?? site.createdAt;

  if (wasOffline) {
    events.push({
      siteId: site.id,
      externalId: `agent:connected:${previousAt.getTime()}`,
      code: "AGENT_CONNECTED",
      occurredAt: now,
    });
  }
  if (status === "degraded" && (wasOffline || site.lastHeartbeatStatus !== "degraded")) {
    events.push({
      siteId: site.id,
      externalId: `service:degraded:${previousAt.getTime()}`,
      code: "SERVICE_DEGRADED",
      occurredAt: now,
    });
  }
  if (status === "healthy" && !wasOffline && site.lastHeartbeatStatus === "degraded") {
    events.push({
      siteId: site.id,
      externalId: `service:recovered:${previousAt.getTime()}`,
      code: "SERVICE_RECOVERED",
      occurredAt: now,
    });
  }
  return events;
}

export function probeTransitionEvents(
  site: SiteProbeState,
  websiteStatus: "ONLINE" | "OFFLINE",
  apiStatus: "ONLINE" | "OFFLINE",
  now: Date,
): PlatformEventDraft[] {
  const events: PlatformEventDraft[] = [];
  if (site.websiteStatus !== websiteStatus) {
    events.push({
      siteId: site.id,
      externalId: `website:${site.websiteCheckedAt?.getTime() ?? 0}:${websiteStatus}`,
      code: `WEBSITE_${websiteStatus}`,
      occurredAt: now,
    });
  }
  if (site.apiStatus !== apiStatus) {
    events.push({
      siteId: site.id,
      externalId: `api:${site.apiCheckedAt?.getTime() ?? 0}:${apiStatus}`,
      code: `API_${apiStatus}`,
      occurredAt: now,
    });
  }

  const lastContact = site.lastHeartbeatAt ?? site.createdAt;
  if (now.getTime() - lastContact.getTime() > heartbeatGraceMs) {
    events.push({
      siteId: site.id,
      externalId: `agent:offline:${lastContact.getTime()}`,
      code: "AGENT_DISCONNECTED",
      occurredAt: now,
    });
  }
  return events;
}
