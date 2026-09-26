import assert from "node:assert/strict";
import test from "node:test";
import {
  heartbeatTransitionEvents,
  probeTransitionEvents,
} from "../src/modules/platform-monitoring/platform-monitoring-events";

const createdAt = new Date("2026-09-26T08:00:00.000Z");
const checkedAt = new Date("2026-09-26T08:05:00.000Z");

test("site and API status transitions create operational events", () => {
  const site = {
    id: "site-1",
    createdAt,
    lastHeartbeatAt: checkedAt,
    lastHeartbeatStatus: "healthy",
    websiteStatus: "ONLINE",
    websiteCheckedAt: createdAt,
    apiStatus: "OFFLINE",
    apiCheckedAt: createdAt,
  };
  const events = probeTransitionEvents(site, "OFFLINE", "ONLINE", checkedAt);
  assert.deepEqual(events.map((event) => event.code), ["WEBSITE_OFFLINE", "API_ONLINE"]);
  assert.equal(probeTransitionEvents({ ...site, websiteStatus: "OFFLINE", apiStatus: "ONLINE" }, "OFFLINE", "ONLINE", checkedAt).length, 0);
});

test("stale agent creates a stable event id across repeated probes", () => {
  const site = {
    id: "site-1",
    createdAt,
    lastHeartbeatAt: createdAt,
    lastHeartbeatStatus: "healthy",
    websiteStatus: "ONLINE",
    websiteCheckedAt: createdAt,
    apiStatus: "ONLINE",
    apiCheckedAt: createdAt,
  };
  const first = probeTransitionEvents(site, "ONLINE", "ONLINE", checkedAt);
  const second = probeTransitionEvents(site, "ONLINE", "ONLINE", new Date(checkedAt.getTime() + 60_000));
  assert.deepEqual(first.map((event) => event.code), ["AGENT_DISCONNECTED"]);
  assert.equal(first[0]?.externalId, second[0]?.externalId);
});

test("heartbeat reconnect and service recovery are logged only on transitions", () => {
  const site = {
    id: "site-1",
    createdAt,
    lastHeartbeatAt: createdAt,
    lastHeartbeatStatus: "degraded",
  };
  assert.deepEqual(
    heartbeatTransitionEvents(site, "degraded", checkedAt).map((event) => event.code),
    ["AGENT_CONNECTED", "SERVICE_DEGRADED"],
  );
  const recent = { ...site, lastHeartbeatAt: new Date(checkedAt.getTime() - 30_000) };
  assert.deepEqual(
    heartbeatTransitionEvents(recent, "healthy", checkedAt).map((event) => event.code),
    ["SERVICE_RECOVERED"],
  );
  assert.equal(heartbeatTransitionEvents({ ...recent, lastHeartbeatStatus: "healthy" }, "healthy", checkedAt).length, 0);
});
