"use client";

import { Activity, AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Clipboard, Download, ExternalLink, Globe2, LayoutDashboard, LogOut, Menu, Plus, RefreshCw, Search, Server, Settings2, ShieldCheck, SlidersHorizontal, UtensilsCrossed, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { apiRequest, logout, restoreSession } from "../lib/api";
import type { AuthSession, GlobalSiteEvent, PlatformAuditEntry, PlatformAuditPage, PlatformDiagnostic, PlatformHealth, PlatformReports, Probe, ProvisionedAgent, Site, SiteEvent } from "../lib/types";

type View = "overview" | "restaurants" | "activity" | "diagnostics" | "audit" | "reports" | "detail";
type Modal = "create" | "edit" | "rotate" | "toggle" | null;

const eventLabels: Record<string, string> = {
  ORDER_STATUS_CHANGED: "Buyurtma holati o'zgardi", KITCHEN_TICKET_CHANGED: "Oshxona buyurtmani yangiladi",
  DEVICE_DISCONNECTED: "Qurilma uzildi", PRINTER_FAILED: "Printerda xato", AGENT_CONNECTED: "Server ulandi",
  AGENT_DISCONNECTED: "Server uzildi", SERVICE_DEGRADED: "Server xizmatida nosozlik", SERVICE_RECOVERED: "Server xizmati tiklandi",
  WEBSITE_OFFLINE: "Sayt ishlamayapti", WEBSITE_ONLINE: "Sayt tiklandi", API_OFFLINE: "API ishlamayapti", API_ONLINE: "API tiklandi",
};

const auditLabels: Record<string, string> = {
  PLATFORM_SITE_CREATED: "Restoran monitoringga qo'shildi",
  PLATFORM_SITE_UPDATED: "Restoran sozlamalari o'zgartirildi",
  PLATFORM_SITE_TOKEN_ROTATED: "Agent tokeni yangilandi",
  PLATFORM_EVENT_ACKNOWLEDGED: "Alert ko'rib chiqildi",
};

function auditSummary(entry: PlatformAuditEntry) {
  const metadata = entry.metadata || {};
  if (entry.action === "PLATFORM_SITE_CREATED") return `${String(metadata.name || "Restoran")} · ${String(metadata.productCode || "")}`;
  if (entry.action === "PLATFORM_SITE_UPDATED") {
    const fields = metadata.changedFields;
    const siteName = String(metadata.siteName || "Restoran");
    return Array.isArray(fields) ? `${siteName} · o'zgargan: ${fields.map(String).join(", ")}` : `${siteName} sozlamalari yangilandi`;
  }
  if (entry.action === "PLATFORM_SITE_TOKEN_ROTATED") return `${String(metadata.siteName || "Restoran")} · agent tokeni almashtirildi`;
  if (entry.action === "PLATFORM_EVENT_ACKNOWLEDGED") return `${String(metadata.siteName || "Restoran")} · hodisa kodi: ${String(metadata.code || "—")}`;
  return entry.entityId || entry.entity;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Hali yo'q";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Noma'lum" : date.toLocaleString("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function downloadReportCsv(reports: PlatformReports) {
  const rows = [
    ["Sana UTC", "Yopilgan buyurtmalar", "Bekor qilingan", "Yopilgan buyurtmalar summasi"],
    ...reports.daily.map(day => [day.day, String(day.completedOrders), String(day.cancelledOrders), String(day.completedOrderTotal)]),
  ];
  const csv = `\uFEFF${rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `bestteam-hisobot-${reports.days}-kun.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function probeText(probe: Probe) {
  if (probe.status === "ONLINE") return probe.latencyMs == null ? "Ishlayapti" : `${probe.latencyMs} ms`;
  return probe.status === "OFFLINE" ? "Ishlamayapti" : "Tekshirilmagan";
}

function eventRecommendation(code: string) {
  const actions: Record<string, string> = {
    WEBSITE_OFFLINE: "Domen DNS yozuvi, TLS sertifikati va web xizmati holatini tekshiring.",
    API_OFFLINE: "Backend xizmati va uning /health endpointi loglarini tekshiring.",
    AGENT_DISCONNECTED: "Agent URL, token va backend heartbeat loglarini tekshiring.",
    SERVICE_DEGRADED: "Restoran backendidagi baza/Redis holati va servis loglarini tekshiring.",
    PRINTER_FAILED: "Printer ulanishi va qayta yuboriladigan bosma navbatini tekshiring.",
    DEVICE_DISCONNECTED: "Qurilma quvvati, tarmog'i va oxirgi aloqa vaqtini tekshiring.",
  };
  return actions[code] || "Restoran serveridagi tegishli xizmat loglarini tekshiring.";
}

function siteStatus(site: Site): "healthy" | "warning" | "danger" | "neutral" {
  if (!site.isActive) return "neutral";
  if (site.website.status === "OFFLINE" || site.api.status === "OFFLINE" || site.agentStatus === "OFFLINE") return "danger";
  if (site.website.status !== "ONLINE" || site.api.status !== "ONLINE" || site.agentStatus !== "ONLINE") return "warning";
  return "healthy";
}

function requiresAcknowledgement(code: string) {
  return code === "WEBSITE_OFFLINE" || code === "API_OFFLINE" || code === "AGENT_DISCONNECTED" || code === "SERVICE_DEGRADED" || code === "PRINTER_FAILED" || code === "DEVICE_DISCONNECTED";
}

function hasLiveHeartbeat(site: Site) {
  return site.agentStatus === "ONLINE" || site.agentStatus === "DEGRADED";
}

function statusText(status: ReturnType<typeof siteStatus>) {
  return { healthy: "Sog'lom", warning: "E'tibor kerak", danger: "Nosozlik", neutral: "Kuzatuv o'chiq" }[status];
}

function Status({ status, label }: { status: string; label?: string }) {
  const tone = ["ONLINE", "OPEN", "healthy", "ok"].includes(status) ? "healthy" : ["OFFLINE", "danger", "down", "error"].includes(status) ? "danger" : ["UNKNOWN", "WAITING", "DEGRADED", "warning"].includes(status) ? "warning" : "neutral";
  return <span className={`status status-${tone}`}><span className="status-dot" />{label || status}</span>;
}

function Empty({ children }: { children: ReactNode }) { return <div className="empty"><CircleHelp size={22} /><span>{children}</span></div>; }

export function OwnerConsole({ view, siteId }: { view: View; siteId?: string }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<Modal>(null);
  const [provisioned, setProvisioned] = useState<ProvisionedAgent | null>(null);
  const [name, setName] = useState("");
  const [productCode, setProductCode] = useState("MAZETTO_FOOD");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [apiHealthUrl, setApiHealthUrl] = useState("");
  const [branchId, setBranchId] = useState("");
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [globalEvents, setGlobalEvents] = useState<GlobalSiteEvent[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [activitySiteId, setActivitySiteId] = useState("");
  const [eventFilter, setEventFilter] = useState<"all" | "open" | "acknowledged">("all");
  const [acknowledgingId, setAcknowledgingId] = useState("");
  const [auditEntries, setAuditEntries] = useState<PlatformAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditHasNext, setAuditHasNext] = useState(false);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditQuery, setAuditQuery] = useState("");
  const [reportDays, setReportDays] = useState<7 | 14>(14);
  const [reports, setReports] = useState<PlatformReports | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [platformHealthError, setPlatformHealthError] = useState("");
  const [diagnostics, setDiagnostics] = useState<PlatformDiagnostic[]>([]);
  const [diagnosticsSiteId, setDiagnosticsSiteId] = useState("");
  const [diagnosticsSeverity, setDiagnosticsSeverity] = useState<"all" | "warning" | "error">("all");
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState("");

  const selected = useMemo(() => sites.find(site => site.id === siteId), [sites, siteId]);
  const loadSites = useCallback(async () => {
    try { setSites(await apiRequest<Site[]>("/platform/sites")); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Restoranlarni yuklab bo'lmadi."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    restoreSession().then(value => { if (active) { setSession(value); void loadSites(); } }).catch(() => {
      if (active) router.replace("/login");
    });
    return () => { active = false; };
  }, [loadSites, router]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => { void loadSites(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [session, loadSites]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const checkHealth = async () => {
      try {
        const result = await apiRequest<PlatformHealth>("/health");
        if (active) { setPlatformHealth(result); setPlatformHealthError(""); }
      } catch (caught) {
        if (active) setPlatformHealthError(caught instanceof Error ? caught.message : "Markaziy serverga ulanib bo'lmadi.");
      }
    };
    void checkHealth();
    const timer = window.setInterval(() => { void checkHealth(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session]);

  useEffect(() => {
    if (!session || (view !== "overview" && view !== "activity")) return;
    let active = true;
    const load = async () => {
      try {
        const value = await apiRequest<GlobalSiteEvent[]>(`/platform/events?limit=${view === "overview" ? 8 : 100}${view === "activity" && activitySiteId ? `&siteId=${encodeURIComponent(activitySiteId)}` : ""}${view === "activity" ? `&state=${eventFilter}` : ""}`);
        if (active) { setGlobalEvents(value); setGlobalError(""); }
      } catch (caught) {
        if (active) setGlobalError(caught instanceof Error ? caught.message : "Hodisalarni yuklab bo'lmadi.");
      } finally { if (active) setGlobalLoading(false); }
    };
    setGlobalLoading(true);
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session, view, activitySiteId, eventFilter]);

  useEffect(() => {
    if (!session || view !== "audit") return;
    let active = true;
    setAuditLoading(true);
    const search = auditQuery.trim();
    apiRequest<PlatformAuditPage>(`/platform/audit?limit=50&offset=${auditOffset}${search ? `&q=${encodeURIComponent(search)}` : ""}`)
      .then(value => { if (active) { setAuditEntries(value.entries); setAuditHasNext(value.hasNext); setAuditError(""); } })
      .catch(caught => { if (active) setAuditError(caught instanceof Error ? caught.message : "Boshqaruv jurnalini yuklab bo'lmadi."); })
      .finally(() => { if (active) setAuditLoading(false); });
    return () => { active = false; };
  }, [session, view, auditOffset, auditQuery]);

  useEffect(() => {
    if (!session || view !== "reports") return;
    let active = true;
    setReportsLoading(true);
    apiRequest<PlatformReports>(`/platform/reports?days=${reportDays}`)
      .then(value => { if (active) { setReports(value); setReportsError(""); } })
      .catch(caught => { if (active) setReportsError(caught instanceof Error ? caught.message : "Hisobotni yuklab bo'lmadi."); })
      .finally(() => { if (active) setReportsLoading(false); });
    return () => { active = false; };
  }, [session, view, reportDays]);

  useEffect(() => {
    if (!session || view !== "diagnostics") return;
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: "200" });
        if (diagnosticsSiteId) params.set("siteId", diagnosticsSiteId);
        if (diagnosticsSeverity !== "all") params.set("severity", diagnosticsSeverity);
        const value = await apiRequest<PlatformDiagnostic[]>(`/platform/diagnostics?${params}`);
        if (active) { setDiagnostics(value); setDiagnosticsError(""); }
      } catch (caught) {
        if (active) setDiagnosticsError(caught instanceof Error ? caught.message : "Diagnostika jurnalini yuklab bo'lmadi.");
      } finally { if (active) setDiagnosticsLoading(false); }
    };
    setDiagnosticsLoading(true);
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session, view, diagnosticsSiteId, diagnosticsSeverity]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    apiRequest<SiteEvent[]>(`/platform/sites/${selected.id}/events?limit=50${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`)
      .then(value => { if (active) { setEvents(value); setEventsError(""); setEventsLoading(false); } })
      .catch(caught => { if (active) { setEventsError(caught instanceof Error ? caught.message : "Hodisalarni yuklab bo'lmadi."); setEventsLoading(false); } });
    return () => { active = false; };
  }, [selected?.id, branchId, sites]);

  const filtered = sites.filter(site => {
    const text = `${site.name} ${site.siteKey} ${site.productCode}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === "all" || siteStatus(site) === filter);
  });
  const attention = sites.filter(site => siteStatus(site) !== "healthy" && site.isActive);
  const healthy = sites.filter(site => siteStatus(site) === "healthy").length;
  const offline = sites.filter(site => siteStatus(site) === "danger").length;
  const queue = sites.reduce((sum, site) => sum + (hasLiveHeartbeat(site) ? site.heartbeat?.totals.kitchenQueue || 0 : 0), 0);
  const visibleGlobalEvents = globalEvents.filter(event => eventFilter === "all" || (eventFilter === "open" ? requiresAcknowledgement(event.code) && !event.acknowledgedAt : Boolean(event.acknowledgedAt)));
  const reportTotals = reports?.daily.reduce((total, day) => ({
    completedOrders: total.completedOrders + day.completedOrders,
    cancelledOrders: total.cancelledOrders + day.cancelledOrders,
    completedOrderTotal: total.completedOrderTotal + day.completedOrderTotal,
  }), { completedOrders: 0, cancelledOrders: 0, completedOrderTotal: 0 });
  const reportMax = Math.max(1, ...(reports?.daily.map(day => day.completedOrderTotal) || []));
  const rankedReportSites = (reports?.sites || []).map(site => ({
    ...site,
    completedOrders: site.reports.reduce((sum, day) => sum + day.completedOrders, 0),
    cancelledOrders: site.reports.reduce((sum, day) => sum + day.cancelledOrders, 0),
    completedOrderTotal: site.reports.reduce((sum, day) => sum + day.completedOrderTotal, 0),
  })).sort((a, b) => b.completedOrderTotal - a.completedOrderTotal);
  const moneyLabel = (value: number) => `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(value)} so'm`;

  async function acknowledgeEvent(event: GlobalSiteEvent) {
    setAcknowledgingId(event.id);
    try {
      const result = await apiRequest<Pick<GlobalSiteEvent, "acknowledgedAt" | "acknowledgedById" | "acknowledgedBy">>(`/platform/events/${event.id}/acknowledge`, { method: "POST" });
      setGlobalEvents(current => current.map(item => item.id === event.id ? { ...item, ...result } : item));
      setNotice("Hodisa ko'rib chiqildi.");
      setGlobalError("");
    } catch (caught) {
      setGlobalError(caught instanceof Error ? caught.message : "Hodisani tasdiqlab bo'lmadi.");
    } finally { setAcknowledgingId(""); }
  }

  async function copyDiagnostics(site: Site) {
    const data = site.heartbeat;
    const lines = [
      `Restoran: ${site.name} (${site.productCode})`,
      `Holat: ${statusText(siteStatus(site))}`,
      `Tekshiruv vaqti: ${dateLabel(site.lastHeartbeatAt)}`,
      `Sayt: ${site.website.status} (${site.website.statusCode ?? "—"}) ${site.website.error || ""}`,
      `API: ${site.api.status} (${site.api.statusCode ?? "—"}) ${site.api.error || ""}`,
      `Backend: ${data?.services.backend || "UNKNOWN"}; baza: ${data?.services.database || "UNKNOWN"}; Redis: ${data?.services.redis || "UNKNOWN"}`,
      `Filiallar: ${data?.totals.branchCount ?? "—"}; faol buyurtmalar: ${data?.totals.openOrders ?? "—"}; oshxona navbati: ${data?.totals.kitchenQueue ?? "—"}`,
      `Qurilmalar: ${data?.totals.onlineDevices ?? "—"} onlayn / ${data?.totals.offlineDevices ?? "—"} oflayn; bosma navbat xatolari: ${data?.totals.deadPrintJobs ?? "—"}`,
      `Zaxira: ${data?.backup?.status || "noma'lum"}; tiklash sinovi: ${data?.backup?.restoreTested ? "o'tgan" : "o'tkazilmagan"}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setNotice("Maxfiy mijoz ma'lumotlarisiz tashxis nusxalandi.");
    } catch {
      setNotice("Tashxisni nusxalash uchun brauzer ruxsati kerak.");
    }
  }

  function openCreate() {
    setName(""); setProductCode("MAZETTO_FOOD"); setWebsiteUrl(""); setApiHealthUrl("");
    setProvisioned(null); setModalError(""); setModal("create");
  }
  function openEdit(site: Site) {
    setName(site.name); setProductCode(site.productCode); setWebsiteUrl(site.websiteUrl); setApiHealthUrl(site.apiHealthUrl); setModalError(""); setModal("edit");
  }
  async function submitSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setModalError("");
    try {
      const body = JSON.stringify({ name: name.trim(), productCode: productCode.trim(), websiteUrl: websiteUrl.trim(), apiHealthUrl: apiHealthUrl.trim() });
      if (modal === "edit" && selected) {
        await apiRequest(`/platform/sites/${selected.id}`, { method: "PATCH", body });
        setNotice("Restoran ma'lumotlari saqlandi."); setModal(null);
      } else {
        const result = await apiRequest<ProvisionedAgent>("/platform/sites", { method: "POST", body });
        setProvisioned(result); setNotice("Restoran qo'shildi. Agent tokenini hozir saqlang.");
      }
      await loadSites();
    } catch (caught) { setModalError(caught instanceof Error ? caught.message : "Amal bajarilmadi."); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!selected || !modal) return;
    setBusy(true); setNotice(""); setModalError("");
    try {
      if (modal === "rotate") {
        const result = await apiRequest<{ agentToken: string }>(`/platform/sites/${selected.id}/rotate-token`, { method: "POST" });
        setProvisioned({ site: selected, agentToken: result.agentToken }); setNotice("Yangi token yaratildi. Uni serverga o'rnating.");
      } else if (modal === "toggle") {
        await apiRequest(`/platform/sites/${selected.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !selected.isActive }) });
        setNotice(selected.isActive ? "Kuzatuv to'xtatildi." : "Kuzatuv yoqildi."); setModal(null);
      }
      await loadSites();
    } catch (caught) { setModalError(caught instanceof Error ? caught.message : "Amal bajarilmadi."); }
    finally { setBusy(false); }
  }

  if (!session) return <div className="boot-screen"><span className="brand-mark">B</span><span>Yuklanmoqda...</span></div>;

  return <div className="shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="sidebar-head"><Link className="brand" href="/" onClick={() => setMobileNav(false)}><span className="brand-mark">B</span><span>BestTeam <strong>Control</strong></span></Link><button className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="Menyuni yopish"><X size={19} /></button></div>
      <nav aria-label="Asosiy menyu">
        <p className="nav-caption">BOSHQARUV</p>
        <Link className={`nav-link ${view === "overview" ? "active" : ""}`} href="/" onClick={() => setMobileNav(false)}><LayoutDashboard size={18} />Umumiy holat</Link>
        <Link className={`nav-link ${view === "restaurants" || view === "detail" ? "active" : ""}`} href="/restaurants" onClick={() => setMobileNav(false)}><UtensilsCrossed size={18} />Restoranlar<span className="nav-count">{sites.length}</span></Link>
        <Link className={`nav-link ${view === "reports" ? "active" : ""}`} href="/reports" onClick={() => setMobileNav(false)}><Activity size={18} />Hisobotlar</Link>
        <Link className={`nav-link ${view === "activity" ? "active" : ""}`} href="/activity" onClick={() => setMobileNav(false)}><Activity size={18} />Hodisalar</Link>
        <Link className={`nav-link ${view === "diagnostics" ? "active" : ""}`} href="/diagnostics" onClick={() => setMobileNav(false)}><AlertTriangle size={18} />Texnik xatolar</Link>
        <Link className={`nav-link ${view === "audit" ? "active" : ""}`} href="/audit" onClick={() => setMobileNav(false)}><Clipboard size={18} />Boshqaruv jurnali</Link>
      </nav>
      <div className="sidebar-bottom"><div className="owner-avatar">BT</div><div className="owner-copy"><strong>BestTeam egasi</strong><span>{session.user.email || session.user.phone || "Bosh administrator"}</span></div><button className="icon-button" title="Chiqish" aria-label="Chiqish" onClick={async () => { await logout(); router.replace("/login"); }}><LogOut size={18} /></button></div>
    </aside>
    {mobileNav && <button className="nav-backdrop" aria-label="Menyuni yopish" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-only" aria-label="Menyuni ochish" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="breadcrumb">BestTeam <span>/</span> {view === "overview" ? "Umumiy holat" : view === "restaurants" ? "Restoranlar" : view === "activity" ? "Hodisalar" : view === "diagnostics" ? "Texnik xatolar" : view === "audit" ? "Boshqaruv jurnali" : view === "reports" ? "Hisobotlar" : selected?.name || "Restoran"}</div><div className="topbar-actions"><span className="live-label" title={platformHealthError ? platformHealthError : `Ma'lumotlar bazasi: ${platformHealth?.database.status || "tekshirilmoqda"}; Redis: ${platformHealth?.redis || "tekshirilmoqda"}`}><span className="live-dot" style={platformHealthError ? { backgroundColor: "#ce4b4b" } : platformHealth?.redis === "fallback" ? { backgroundColor: "#d69120" } : undefined} />{platformHealthError ? "API uzildi" : !platformHealth ? "API tekshirilmoqda" : platformHealth.redis === "fallback" ? "API onlayn · Redis zaxira" : "API onlayn"}</span><button className="icon-button" title="Yangilash" aria-label="Yangilash" onClick={() => { setLoading(true); void loadSites(); }}><RefreshCw size={18} /></button></div></header>
      <div className="content">
        {notice && <div className="notice" role="status">{notice}<button aria-label="Xabarni yopish" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {error && <div className="alert" role="alert"><AlertTriangle size={18} />{error}<button className="button subtle" onClick={() => void loadSites()}>Qayta urinish</button></div>}
        {view === "overview" && <>
          <div className="page-heading"><div><p className="eyebrow">BARCHA LOYIHALAR</p><h1>Umumiy holat</h1><p className="muted">Restoranlar va oshxonalarning hozirgi ish holati</p></div><button className="button primary" onClick={openCreate}><Plus size={17} />Restoran qo'shish</button></div>
          <div className="metrics"><Metric icon={<Globe2 size={20} />} label="Restoranlar" value={sites.length} caption="Ro'yxatdagi obyektlar" /><Metric icon={<ShieldCheck size={20} />} label="Sog'lom" value={healthy} caption="Barcha xizmatlar ishlayapti" tone="healthy" /><Metric icon={<AlertTriangle size={20} />} label="Nosozlik" value={offline} caption="Zudlik bilan tekshirish" tone="danger" /><Metric icon={<UtensilsCrossed size={20} />} label="Oshxona navbati" value={queue} caption="Jami navbatdagi buyurtmalar" tone="warning" /></div>
          <section className="section"><div className="section-head"><div><h2>E'tibor talab qiladi</h2><p className="muted">Sayt, API yoki server bilan bog'liq holatlar</p></div><Link className="text-link" href="/restaurants">Barchasini ko'rish <ArrowRight size={16} /></Link></div>{loading ? <Skeleton /> : attention.length ? <div className="attention-list">{attention.slice(0, 5).map(site => <Link className="attention-row" href={`/restaurants/${site.id}`} key={site.id}><span className={`attention-icon tone-${siteStatus(site)}`}><AlertTriangle size={19} /></span><span className="attention-name"><strong>{site.name}</strong><small>{site.productCode}</small></span><Status status={siteStatus(site)} label={statusText(siteStatus(site))} /><span className="row-time">{dateLabel(site.lastHeartbeatAt)}</span><ArrowRight size={17} /></Link>)}</div> : <Empty>Hozircha e'tibor talab qiladigan restoran yo'q.</Empty>}</section>
          <section className="section"><div className="section-head"><div><h2>Restoranlar</h2><p className="muted">Barcha ulangan loyihalarning qisqa ko'rinishi</p></div><Link className="text-link" href="/restaurants">Ro'yxatga o'tish <ArrowRight size={16} /></Link></div><SiteTable sites={sites.slice(0, 6)} loading={loading} /></section>
          <section className="section"><div className="section-head"><div><h2>So'nggi hodisalar</h2><p className="muted">Barcha restoranlardan kelgan operatsion yozuvlar</p></div><Link className="text-link" href="/activity">Jurnalni ochish <ArrowRight size={16} /></Link></div>{globalError ? <div className="alert">{globalError}</div> : globalLoading ? <Skeleton /> : <GlobalEvents events={globalEvents.slice(0, 6)} />}</section>
        </>}
        {view === "activity" && <>
          <div className="page-heading"><div><p className="eyebrow">OPERATSION JURNAL</p><h1>Hodisalar</h1><p className="muted">Barcha restoranlar va filiallardan kelgan so'nggi o'zgarishlar.</p></div></div>
          <div className="toolbar"><label className="filter-label"><SlidersHorizontal size={17} /><select value={activitySiteId} onChange={event => setActivitySiteId(event.target.value)} aria-label="Restoran bo'yicha filter"><option value="">Barcha restoranlar</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select><ChevronDown size={15} /></label><div className="segmented" role="group" aria-label="Hodisalar holati"><button aria-pressed={eventFilter === "all"} onClick={() => setEventFilter("all")}>Barchasi</button><button aria-pressed={eventFilter === "open"} onClick={() => setEventFilter("open")}>Ochiq</button><button aria-pressed={eventFilter === "acknowledged"} onClick={() => setEventFilter("acknowledged")}>Ko'rib chiqilgan</button></div><span className="result-count">{visibleGlobalEvents.length} ta hodisa</span></div>
          {globalError ? <div className="alert">{globalError}</div> : globalLoading ? <Skeleton /> : <GlobalEvents events={visibleGlobalEvents} emptyText={eventFilter === "open" ? "Ochiq hodisalar topilmadi." : "Hodisalar hali qayd etilmagan."} onAcknowledge={event => void acknowledgeEvent(event)} acknowledgingId={acknowledgingId} />}
        </>}
        {view === "diagnostics" && <>
          <div className="page-heading"><div><p className="eyebrow">30 KUNLIK TEXNIK JURNAL</p><h1>Texnik xatolar</h1><p className="muted">Faqat oldindan belgilangan texnik xato kodlari saqlanadi. Xom log va maxfiy ma'lumotlar uzatilmaydi.</p></div></div>
          <div className="toolbar"><label className="filter-label"><SlidersHorizontal size={17} /><select value={diagnosticsSiteId} onChange={event => setDiagnosticsSiteId(event.target.value)} aria-label="Restoran bo'yicha filtr"><option value="">Barcha restoranlar</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select><ChevronDown size={15} /></label><label className="filter-label"><select value={diagnosticsSeverity} onChange={event => setDiagnosticsSeverity(event.target.value as typeof diagnosticsSeverity)} aria-label="Xato darajasi"><option value="all">Barcha darajalar</option><option value="error">Xatolar</option><option value="warning">Ogohlantirishlar</option></select><ChevronDown size={15} /></label><span className="result-count">{diagnostics.length} ta yozuv</span></div>
          {diagnosticsError ? <div className="alert">{diagnosticsError}</div> : diagnosticsLoading ? <Skeleton /> : diagnostics.length ? <div className="events-list">{diagnostics.map(item => <div className="event-row" key={item.id}><span className={`event-dot ${item.severity === "error" ? "tone-danger" : "tone-warning"}`} /><span><strong>{item.code === "LOCAL_HEARTBEAT_BUILD_FAILED" ? "Restoran holatini yig'ishda xato" : item.code === "CONTROL_PLANE_REJECTED_HEARTBEAT" ? "Markaziy panel heartbeatni qabul qilmadi" : "Markaziy panelga ulanish uzildi"}</strong><small>{item.site.name} · {item.service === "control_plane" ? "Markaziy aloqa" : item.service === "backend" ? "Restoran backendi" : item.service === "database" ? "Ma'lumotlar bazasi" : "Redis"}</small><small>{item.severity === "error" ? "Xato" : "Ogohlantirish"} · Qabul qilindi: {dateLabel(item.receivedAt)}</small></span><time>{dateLabel(item.occurredAt)}</time></div>)}</div> : <Empty>So'nggi 30 kunda texnik xato qayd etilmagan.</Empty>}
        </>}
        {view === "audit" && <>
          <div className="page-heading"><div><p className="eyebrow">EGASI AMALLARI</p><h1>Boshqaruv jurnali</h1><p className="muted">Restoran sozlamalari va alertlar bo'yicha bajarilgan amallar.</p></div></div>
          <div className="audit-toolbar"><label className="search-field"><Search size={17} /><input value={auditQuery} onChange={event => { setAuditOffset(0); setAuditQuery(event.target.value); }} placeholder="Amal yoki egasi bo'yicha qidirish" /></label><span className="result-count">{auditEntries.length} ta yozuv</span></div>
          {auditError ? <div className="alert" role="alert">{auditError}</div> : auditLoading ? <Skeleton /> : auditEntries.length ? <div className="audit-list">{auditEntries.map(entry => <article className="audit-row" key={entry.id}><span className="audit-icon"><Clipboard size={17} /></span><div className="audit-copy"><strong>{auditLabels[entry.action] || entry.action}</strong><span>{entry.user?.displayName || entry.user?.email || entry.user?.phone || "Hisob o'chirilgan"}</span><small>{auditSummary(entry)}</small></div><time>{dateLabel(entry.createdAt)}</time></article>)}</div> : <Empty>{auditQuery ? "Qidiruvga mos yozuv topilmadi." : "Boshqaruv amallari hali qayd etilmagan."}</Empty>}
          <div className="audit-pagination"><button className="button subtle" onClick={() => setAuditOffset(value => Math.max(0, value - 50))} disabled={auditOffset === 0 || auditLoading}>Oldingi</button><span>{auditEntries.length ? `${auditOffset + 1}–${auditOffset + auditEntries.length}` : "0 ta"}</span><button className="button subtle" onClick={() => setAuditOffset(value => value + 50)} disabled={!auditHasNext || auditLoading}>Keyingisi</button></div>
        </>}
        {view === "reports" && <>
          <div className="page-heading"><div><p className="eyebrow">RESTORANLAR TAHLILI</p><h1>Hisobotlar</h1><p className="muted">Restoranlardan kelgan yig'ma natijalar. Shaxsiy mijoz ma'lumotlari ko'rsatilmaydi.</p></div><div className="heading-actions"><label className="filter-label"><SlidersHorizontal size={17} /><select value={reportDays} onChange={event => setReportDays(Number(event.target.value) as 7 | 14)} aria-label="Hisobot davri"><option value={7}>7 kun</option><option value={14}>14 kun</option></select><ChevronDown size={15} /></label><button className="button subtle" onClick={() => reports && downloadReportCsv(reports)} disabled={!reports || reportsLoading}><Download size={16} />CSV yuklab olish</button></div></div>
          {reportsError && <div className="alert" role="alert">{reportsError}</div>}
          {reportsLoading && !reports ? <Skeleton /> : <>
            <div className="metrics"><Metric icon={<UtensilsCrossed size={20} />} label="Yopilgan buyurtma" value={reportTotals?.completedOrders || 0} caption={`${reportDays} kun bo'yicha`} tone="healthy" /><Metric icon={<Activity size={20} />} label="Buyurtma summasi" value={moneyLabel(reportTotals?.completedOrderTotal || 0)} caption="Yopilgan buyurtmalar, qaytarishlar ayrilmagan" /><Metric icon={<AlertTriangle size={20} />} label="Bekor qilingan" value={reportTotals?.cancelledOrders || 0} caption="Tanlangan davrda" tone="warning" /><Metric icon={<Globe2 size={20} />} label="Hisobot yuborgan" value={rankedReportSites.filter(site => !site.stale && site.reports.length > 0).length} caption={`${rankedReportSites.length} ta faol restoran ichidan`} /></div>
            <section className="section"><div className="section-head"><div><h2>Kundalik ko'rsatkichlar</h2><p className="muted">Yopilgan buyurtmalar summasi va soni. Sana UTC bo'yicha.</p></div><span className="section-meta">Yangilandi: {dateLabel(reports?.generatedAt)}</span></div>
              {reports?.daily.some(day => day.completedOrders || day.cancelledOrders) ? <div className={`report-chart report-chart-${reports.days}`}>{reports.daily.map(day => <div className="report-day" key={day.day}><div className="report-bar-wrap" title={`${day.completedOrders} ta · ${moneyLabel(day.completedOrderTotal)}`}><div className="report-bar" style={{ height: `${Math.max(day.completedOrderTotal > 0 ? 5 : 0, day.completedOrderTotal / reportMax * 100)}%` }} /></div><strong>{day.completedOrders}</strong><span>{new Date(`${day.day}T12:00:00Z`).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", timeZone: "UTC" })}</span></div>)}</div> : <Empty>Hali hisobot raqamlari kelmagan. Restoran serverida BestTeam agenti ulangan bo'lishi kerak.</Empty>}
            </section>
            <section className="section"><div className="section-head"><div><h2>Restoranlar kesimida</h2><p className="muted">Davr bo'yicha yig'ma tahlil; yangi heartbeat kelmasa ma'lumot eskirgan deb belgilanadi.</p></div></div>{rankedReportSites.length ? <div className="table-wrap"><table><thead><tr><th>Restoran</th><th>Yopilgan buyurtma</th><th>Bekor</th><th>Buyurtma summasi</th><th>Agent holati</th><th>So'nggi aloqa</th></tr></thead><tbody>{rankedReportSites.map(site => <tr key={site.siteId}><td className="strong-cell">{site.name}<small className="report-product">{site.productCode}</small></td><td>{site.completedOrders}</td><td>{site.cancelledOrders}</td><td>{moneyLabel(site.completedOrderTotal)}</td><td><Status status={site.stale ? "DEGRADED" : site.reports.length ? "ONLINE" : "UNKNOWN"} label={site.stale ? "Ma'lumot eskirgan" : site.reports.length ? "Yangilangan" : "Hisobot yo'q"} /></td><td>{dateLabel(site.lastHeartbeatAt)}</td></tr>)}</tbody></table></div> : <Empty>Restoranlar hali ulanmagan.</Empty>}</section>
          </>}
        </>}
        {view === "restaurants" && <>
          <div className="page-heading"><div><p className="eyebrow">LOYIHALAR REYESTRI</p><h1>Restoranlar</h1><p className="muted">Har bir restoran o'z domenida ishlaydi; bu yerda ularning holati kuzatiladi.</p></div><button className="button primary" onClick={openCreate}><Plus size={17} />Restoran qo'shish</button></div>
          <div className="toolbar"><label className="search"><Search size={18} /><input placeholder="Nomi yoki loyiha bo'yicha qidirish" value={query} onChange={event => setQuery(event.target.value)} /></label><label className="filter-label"><SlidersHorizontal size={17} /><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Holat bo'yicha filter"><option value="all">Barcha holatlar</option><option value="healthy">Sog'lom</option><option value="warning">E'tibor kerak</option><option value="danger">Nosozlik</option><option value="neutral">Kuzatuv o'chiq</option></select><ChevronDown size={15} /></label><span className="result-count">{filtered.length} ta restoran</span></div>
          <SiteTable sites={filtered} loading={loading} />
        </>}
        {view === "detail" && selected && <>
          <Link className="back-link" href="/restaurants"><ArrowLeft size={17} /> Restoranlar</Link>
          <div className="page-heading detail-heading"><div><p className="eyebrow">{selected.productCode} / {selected.siteKey}</p><h1>{selected.name}</h1><div className="detail-sub"><Status status={siteStatus(selected)} label={statusText(siteStatus(selected))} /><span>So'nggi aloqa: {dateLabel(selected.lastHeartbeatAt)}</span></div></div><div className="heading-actions"><a className="button subtle" href={selected.websiteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Saytni ochish</a><button className="button subtle" onClick={() => void copyDiagnostics(selected)}><Clipboard size={16} /> Tashxis nusxalash</button><button className="button subtle" onClick={() => openEdit(selected)}><Settings2 size={16} /> Sozlamalar</button></div></div>
          <div className="service-grid"><Service title="Veb-sayt" icon={<Globe2 size={20} />} status={selected.website.status} value={probeText(selected.website)} detail={selected.website.error || `Tekshirildi: ${dateLabel(selected.website.checkedAt)}`} /><Service title="API" icon={<Activity size={20} />} status={selected.api.status} value={probeText(selected.api)} detail={selected.api.error || `Tekshirildi: ${dateLabel(selected.api.checkedAt)}`} /><Service title="Server agenti" icon={<Server size={20} />} status={selected.agentStatus} value={selected.agentStatus === "ONLINE" ? "Ulangan" : selected.agentStatus === "OFFLINE" ? "Ulanmagan" : selected.agentStatus === "WAITING" ? "Kutilmoqda" : selected.agentStatus === "DISABLED" ? "O'chirilgan" : "Nosozlik"} detail={`So'nggi aloqa: ${dateLabel(selected.lastHeartbeatAt)}`} /></div>
          {!hasLiveHeartbeat(selected) && selected.heartbeat && <div className="alert" role="status"><AlertTriangle size={18} />Agentdan yangi ma'lumot kelmayapti. Quyidagi holat {dateLabel(selected.lastHeartbeatAt)} vaqtidagi oxirgi xabardan olingan.</div>}
          <section className="section"><div className="section-head"><div><h2>Server xizmatlari</h2><p className="muted">Restoran backendidan kelgan oxirgi ma'lumot</p></div><span className="section-meta">Versiya {selected.heartbeat?.version || "noma'lum"}</span></div><div className="service-strip">{(["backend", "database", "redis"] as const).map(key => <div className="service-line" key={key}><span>{key === "backend" ? "Backend" : key === "database" ? "Ma'lumotlar bazasi" : "Redis"}</span><Status status={hasLiveHeartbeat(selected) ? selected.heartbeat?.services[key] || "UNKNOWN" : "UNKNOWN"} label={hasLiveHeartbeat(selected) ? selected.heartbeat?.services[key] || "Noma'lum" : "Oxirgi holat noma'lum"} /></div>)}</div></section>
          <section className="section"><div className="section-head"><div><h2>Zaxira nusxa holati</h2><p className="muted">Restoran serveridagi arxiv dalili; tiklash sinovi alohida tekshiriladi.</p></div></div>{selected.heartbeat?.backup ? <div className="backup-summary"><Status status={selected.heartbeat.backup.status === "verified" ? "ONLINE" : selected.heartbeat.backup.status === "not_configured" ? "UNKNOWN" : "DEGRADED"} label={{ verified: "Arxiv tekshirildi", stale: "Arxiv eskirgan", unavailable: "Tekshirib bo'lmadi", not_configured: "Sozlanmagan" }[selected.heartbeat.backup.status]} /><span>{selected.heartbeat.backup.verifiedAt ? `Oxirgi tekshiruv: ${dateLabel(selected.heartbeat.backup.verifiedAt)}` : "Tekshirilgan arxiv dalili topilmadi."}</span><span>{selected.heartbeat.backup.bytes ? `${new Intl.NumberFormat("uz-UZ").format(selected.heartbeat.backup.bytes)} bayt · ${selected.heartbeat.backup.archiveEntries ?? 0} tarkib yozuvi` : "Arxiv hajmi noma'lum"}</span><strong>{selected.heartbeat.backup.restoreTested ? "Tiklash sinovi o'tgan" : "Tiklash sinovi hali o'tkazilmagan"}</strong></div> : <Empty>Restoran agentidan backup holati kelmagan. Agent yangilanishi kerak.</Empty>}</section>
          <section className="section"><div className="section-head"><div><h2>Oshxonalar</h2><p className="muted">Filiallar bo'yicha navbat va qurilmalar</p></div><span className="section-meta">{selected.heartbeat?.kitchens.length || 0} ta filial</span></div>{selected.heartbeat?.kitchens.length ? <div className="table-wrap"><table><thead><tr><th>Filial</th><th>Holat</th><th>Ochiq buyurtma</th><th>Navbat</th><th>Qurilmalar</th><th>So'nggi faollik</th></tr></thead><tbody>{selected.heartbeat.kitchens.map(kitchen => <tr key={kitchen.branchId}><td className="strong-cell">{kitchen.name}</td><td><Status status={kitchen.status} label={kitchen.status === "OPEN" ? "Ochiq" : "Yopiq"} /></td><td>{kitchen.openOrders}</td><td>{kitchen.kitchenQueue}</td><td>{kitchen.onlineDevices} onlayn / {kitchen.offlineDevices} oflayn</td><td>{dateLabel(kitchen.lastActivityAt)}</td></tr>)}</tbody></table></div> : <Empty>Oshxona ma'lumoti hali kelmagan.</Empty>}</section>
          <section className="section"><div className="section-head"><div><h2>Hodisalar jurnali</h2><p className="muted">Server va filiallarda sodir bo'lgan o'zgarishlar</p></div><label className="filter-label"><select value={branchId} onChange={event => { setEventsLoading(true); setBranchId(event.target.value); }} aria-label="Filialni tanlash"><option value="">Barcha filiallar</option>{selected.heartbeat?.kitchens.map(kitchen => <option value={kitchen.branchId} key={kitchen.branchId}>{kitchen.name}</option>)}</select><ChevronDown size={15} /></label></div>{eventsError ? <div className="alert">{eventsError}</div> : eventsLoading ? <Skeleton /> : events.length ? <div className="events-list">{events.map(event => <div className="event-row" key={event.id}><span className="event-dot" /><span><strong>{eventLabels[event.code] || event.code}</strong><small>{event.branchName || "Butun restoran"}</small><small className="event-recommendation">{eventRecommendation(event.code)}</small></span><time>{dateLabel(event.occurredAt)}</time></div>)}</div> : <Empty>Hodisalar topilmadi.</Empty>}</section>
          <section className="section settings-section"><div className="section-head"><div><h2>Monitoring sozlamalari</h2><p className="muted">Agent tokeni va kuzatuv holati</p></div></div><div className="setting-row"><div><strong>Agent tokenini yangilash</strong><p className="muted">Eski token darhol bekor bo'ladi. Yangi tokenni restoran serveriga kiriting.</p></div><button className="button subtle" onClick={() => { setProvisioned(null); setModalError(""); setModal("rotate"); }}>Yangilash</button></div><div className="setting-row"><div><strong>Kuzatuv</strong><p className="muted">Restoran ro'yxatda qoladi, avtomatik tekshiruvlar to'xtaydi.</p></div><button className="button subtle" onClick={() => { setModalError(""); setModal("toggle"); }}>{selected.isActive ? "To'xtatish" : "Yoqish"}</button></div></section>
        </>}
        {view === "detail" && !selected && !loading && <Empty>Bu restoran topilmadi. <Link href="/restaurants">Ro'yxatga qaytish</Link></Empty>}
      </div>
    </main>
        {modal && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) { setModal(null); setProvisioned(null); } }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className="eyebrow">BESTTEAM CONTROL</p><h2 id="modal-title">{modal === "create" ? "Restoran qo'shish" : modal === "edit" ? "Restoranni tahrirlash" : modal === "rotate" ? "Agent tokenini yangilash" : "Kuzatuv holati"}</h2></div><button className="icon-button" aria-label="Yopish" onClick={() => { setModal(null); setProvisioned(null); }}><X size={20} /></button></div>{modalError && <div className="alert" role="alert" style={{ margin: "12px 22px 0" }}>{modalError}</div>}{provisioned ? <div className="modal-body"><p className="muted">Token faqat shu oynada ko'rinadi. Uni restoran serveridagi agent sozlamasiga kiriting.</p><label className="token-field">Agent tokeni<code>{provisioned.agentToken}</code></label><button className="button primary full" onClick={async () => { await navigator.clipboard.writeText(provisioned.agentToken); setNotice("Token nusxalandi."); }}><Clipboard size={16} />Nusxalash</button><button className="button subtle full" onClick={() => { setModal(null); setProvisioned(null); }}>Tayyor</button></div> : modal === "create" || modal === "edit" ? <form className="modal-body form-stack" onSubmit={submitSite}><label>Restoran nomi<input value={name} onChange={event => setName(event.target.value)} required minLength={2} /></label><label>Loyiha kodi<input value={productCode} onChange={event => setProductCode(event.target.value)} required placeholder="MAZETTO_FOOD" /></label><label>Sayt manzili<input type="url" value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} required placeholder="https://restaurant.uz" /></label><label>API holat manzili<input type="url" value={apiHealthUrl} onChange={event => setApiHealthUrl(event.target.value)} required placeholder="https://api.restaurant.uz/health" /></label><div className="modal-actions"><button type="button" className="button subtle" onClick={() => setModal(null)}>Bekor qilish</button><button className="button primary" type="submit" disabled={busy}><Check size={16} />{busy ? "Saqlanmoqda..." : "Saqlash"}</button></div></form> : <div className="modal-body"><p>{modal === "rotate" ? "Eski agent tokeni darhol ishlamay qoladi. Davom etasizmi?" : selected?.isActive ? "Bu restoran uchun monitoringni to'xtatasizmi?" : "Bu restoran uchun monitoringni yoqasizmi?"}</p><div className="modal-actions"><button className="button subtle" onClick={() => setModal(null)}>Bekor qilish</button><button className="button primary" onClick={() => void confirmAction()} disabled={busy}>{busy ? "Bajarilmoqda..." : "Tasdiqlash"}</button></div></div>}</div></div>}
  </div>;
}

function Metric({ icon, label, value, caption, tone = "normal" }: { icon: ReactNode; label: string; value: number | string; caption: string; tone?: string }) { return <div className="metric"><div className={`metric-icon tone-${tone}`}>{icon}</div><div><span className="metric-label">{label}</span><strong className={typeof value === "string" ? "metric-value-long" : undefined}>{value}</strong><small>{caption}</small></div></div>; }
function Service({ title, icon, status, value, detail }: { title: string; icon: ReactNode; status: string; value: string; detail: string }) { return <div className="service-item"><div className="service-top"><span className="service-icon">{icon}</span><Status status={status} label={status === "ONLINE" ? "Onlayn" : status === "OFFLINE" ? "Oflayn" : status === "UNKNOWN" ? "Noma'lum" : status === "WAITING" ? "Kutilmoqda" : status === "DEGRADED" ? "Nosozlik" : status === "DISABLED" ? "O'chirilgan" : status} /></div><h3>{title}</h3><strong>{value}</strong><small>{detail}</small></div>; }
function Skeleton() { return <div className="skeleton" aria-label="Yuklanmoqda"><span /><span /><span /></div>; }
function GlobalEvents({ events, onAcknowledge, acknowledgingId = "", emptyText = "Hodisalar hali qayd etilmagan." }: { events: GlobalSiteEvent[]; onAcknowledge?: (event: GlobalSiteEvent) => void; acknowledgingId?: string; emptyText?: string }) {
  if (!events.length) return <Empty>{emptyText}</Empty>;
  return <div className="global-events">{events.map(event => {
    const alert = requiresAcknowledgement(event.code);
    return <div className="global-event" key={event.id}>
      <span className={`global-event-icon ${alert ? "tone-danger" : "tone-healthy"}`}>{alert ? <AlertTriangle size={17} /> : <Activity size={17} />}</span>
      <Link href={`/restaurants/${event.siteId}`} className="global-event-copy"><strong>{eventLabels[event.code] || event.code}</strong><small>{event.site.name}{event.branchName ? ` · ${event.branchName}` : ""}</small></Link>
      {event.acknowledgedAt ? <span className="ack-status">Ko'rib chiqildi: {event.acknowledgedBy?.displayName || event.acknowledgedBy?.email || event.acknowledgedBy?.phone || "BestTeam egasi"} · {dateLabel(event.acknowledgedAt)}</span> : alert && onAcknowledge ? <button className="button subtle acknowledge-button" onClick={() => onAcknowledge(event)} disabled={acknowledgingId === event.id}>{acknowledgingId === event.id ? "Saqlanmoqda..." : "Ko'rib chiqildi"}</button> : null}
      <time>{dateLabel(event.occurredAt)}</time><Link className="icon-button" title="Restoranni ochish" aria-label={`${event.site.name} jurnalini ochish`} href={`/restaurants/${event.siteId}`}><ArrowRight size={16} /></Link>
    </div>;
  })}</div>;
}
function SiteTable({ sites, loading }: { sites: Site[]; loading: boolean }) { if (loading) return <Skeleton />; if (!sites.length) return <Empty>Restoranlar topilmadi.</Empty>; return <div className="table-wrap"><table><thead><tr><th>Restoran</th><th>Holat</th><th>Sayt</th><th>API</th><th>Agent</th><th>Oshxona navbati</th><th>So'nggi aloqa</th><th><span className="sr-only">Ochish</span></th></tr></thead><tbody>{sites.map(site => <tr key={site.id}><td><Link className="table-link" href={`/restaurants/${site.id}`}><span className="restaurant-avatar">{site.name.slice(0, 2).toUpperCase()}</span><span><strong>{site.name}</strong><small>{site.productCode}</small></span></Link></td><td><Status status={siteStatus(site)} label={statusText(siteStatus(site))} /></td><td><Status status={site.website.status} label={probeText(site.website)} /></td><td><Status status={site.api.status} label={probeText(site.api)} /></td><td><Status status={site.agentStatus} label={{ ONLINE: "Ulangan", DEGRADED: "Muammo bor", OFFLINE: "Ulanmagan", WAITING: "Kutilmoqda", DISABLED: "Kuzatuv o'chiq" }[site.agentStatus]} /></td><td>{hasLiveHeartbeat(site) ? site.heartbeat?.totals.kitchenQueue ?? "—" : "—"}</td><td>{dateLabel(site.lastHeartbeatAt)}</td><td><Link className="icon-button" title="Batafsil" aria-label={`${site.name} batafsil`} href={`/restaurants/${site.id}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>; }
