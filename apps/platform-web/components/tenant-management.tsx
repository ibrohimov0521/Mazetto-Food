"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Clipboard, ExternalLink, LoaderCircle, Plus, Save, ShieldCheck, X } from "lucide-react";
import { apiRequest } from "../lib/api";
import type { TenantMembership, TenantRegistryEntry } from "../lib/types";
import {
  createTenantBranchCodeFromName,
  normalizeTenantBranchCodeInput,
  tenantCodePattern,
  tenantSubdomainPattern,
} from "../lib/tenant-branch-code.mjs";

type Feature = { code: string; name: string; description: string; group: string; isEnabled: boolean };

const featureCatalog = [
  { code: "CUSTOMER_WEB", name: "Mijozlar sayti", description: "Mijozlar uchun menyu va sayt.", group: "Kanallar" },
  { code: "WEB_ORDERS", name: "Saytdan online buyurtma", description: "Sayt orqali buyurtma va checkout.", group: "Kanallar" },
  { code: "TELEGRAM_ORDERS", name: "Telegram buyurtmalari", description: "Telegram bot orqali buyurtmalar.", group: "Kanallar" },
  { code: "INVENTORY", name: "Ombor va retseptlar", description: "Qoldiq, kirim-chiqim va retseptlar.", group: "Ish jarayonlari" },
  { code: "KITCHEN_DISPLAY", name: "Oshxona paneli", description: "Oshxona navbati va buyurtma holatlari.", group: "Ish jarayonlari" },
  { code: "TV_DISPLAY", name: "Televizor rejimi", description: "Oshxona panelini katta ekran va masofadan o‘qishga mos ko‘rsatish.", group: "Ish jarayonlari" },
  { code: "DELIVERY", name: "Yetkazib berish", description: "Kuryer va yetkazib berish oqimi.", group: "Ish jarayonlari" },
  { code: "TABLE_SERVICE", name: "Zal va ofitsiant", description: "Stollar va ofitsiant buyurtmalari.", group: "Ish jarayonlari" },
  { code: "MULTI_BRANCH", name: "Bir nechta filial", description: "Bitta restoran uchun qo‘shimcha filiallar.", group: "Tashkilot" },
] as const;
const defaultFeatures = ["KITCHEN_DISPLAY", "TABLE_SERVICE"];
type OnboardingResult = {
  tenant: { id: string; name: string; code: string; status: string };
  owner: { displayName: string; email: string | null; phone: string | null };
  branch: { name: string; isActive: boolean };
  domain: { hostname: string; status: string };
  dnsRecord: { type: "TXT"; name: string; value: string };
};

export function TenantOnboardingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [values, setValues] = useState({
    name: "", code: "", phone: "", email: "", address: "", legalName: "", taxId: "",
    ownerName: "", ownerLogin: "", ownerPassword: "", branchName: "", branchCode: "", subdomain: "",
  });
  const [branchCodeManuallyEdited, setBranchCodeManuallyEdited] = useState(false);
  const [enabled, setEnabled] = useState<string[]>([...defaultFeatures]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [copied, setCopied] = useState("");

  function update(field: keyof typeof values, value: string) {
    if (field === "branchName") {
      setValues((current) => ({
        ...current,
        branchName: value,
        ...(branchCodeManuallyEdited ? {} : { branchCode: createTenantBranchCodeFromName(value) }),
      }));
      return;
    }
    if (field === "code") {
      setValues((current) => ({
        ...current,
        code: normalizeTenantBranchCodeInput(value),
      }));
      return;
    }
    if (field === "branchCode") {
      const branchCode = normalizeTenantBranchCodeInput(value);
      setBranchCodeManuallyEdited(Boolean(branchCode));
      setValues((current) => ({ ...current, branchCode }));
      return;
    }
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleFeature(code: string, checked: boolean) {
    setEnabled((current) => {
      const next = new Set(current);
      if (checked) next.add(code); else next.delete(code);
      if (code === "WEB_ORDERS" && checked) next.add("CUSTOMER_WEB");
      if (code === "CUSTOMER_WEB" && !checked) next.delete("WEB_ORDERS");
      if (code === "TV_DISPLAY" && checked) next.add("KITCHEN_DISPLAY");
      if (code === "KITCHEN_DISPLAY" && !checked) next.delete("TV_DISPLAY");
      return [...next];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const created = await apiRequest<OnboardingResult>("/platform/tenants/onboard", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          phone: values.phone || undefined, email: values.email || undefined, address: values.address || undefined,
          legalName: values.legalName || undefined, taxId: values.taxId || undefined,
          enabledFeatureCodes: enabled,
        }),
      });
      setValues((current) => ({ ...current, ownerPassword: "" }));
      setResult(created);
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Restoran yaratilmadi.");
    } finally { setBusy(false); }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label); window.setTimeout(() => setCopied(""), 1600);
    } catch { setError("Nusxalashga ruxsat berilmadi. Matnni belgilang va qo‘lda nusxalang."); }
  }

  const groups = [...new Set(featureCatalog.map((feature) => feature.group))];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="tenant-onboard-title">
      <div className="modal-head"><div><p className="eyebrow">BESTTEAM CONTROL</p><h2 id="tenant-onboard-title">{result ? "Restoran tayyorlandi" : "Yangi restoran"}</h2></div><button className="icon-button" type="button" aria-label="Yopish" onClick={onClose} disabled={busy}><X size={20} /></button></div>
      {error && <div className="alert" role="alert" style={{ margin: "12px 22px 0" }}>{error}</div>}
      {result ? <div className="modal-body tenant-result">
        <div className="alert"><Check size={17} />Restoran va owner hisobi yaratildi. Tenant tekshiruv tugaguncha tayyorlanmoqda; owner hozircha tizimga kira olmaydi.</div>
        <div className="tenant-result-grid">
          <div><small>Restoran</small><strong>{result.tenant.name} · {result.tenant.code}</strong></div>
          <div><small>Owner login</small><strong>{result.owner.email || result.owner.phone}</strong><button className="button subtle" type="button" onClick={() => void copy(result.owner.email || result.owner.phone || "", "login")}><Clipboard size={15} />{copied === "login" ? "Nusxalandi" : "Loginni nusxalash"}</button></div>
          <div><small>Admin manzili</small><strong>https://{result.domain.hostname}</strong></div>
          {enabled.includes("CUSTOMER_WEB")
            ? <div><small>Mijozlar sayti</small><strong>https://www.{result.domain.hostname}</strong></div>
            : <div><small>Mijozlar sayti</small><strong>O‘chirilgan</strong></div>}
        </div>
        <div className="alert" role="note">Domen tasdiqlanishi va server routing/TLS sozlanishi kerak. TXT yozuvi faqat domen egaligini tekshiradi; panelni internetda avtomatik yoqmaydi. Owner paroli siz kiritgan qiymat bilan o‘rnatildi va qayta ko‘rsatilmaydi.</div>
        <section className="tenant-dns-result"><div><strong>DNS tasdiqlash yozuvi</strong><p className="muted">DNS boshqaruvida TXT yozuvini qo‘shing, keyin domenlar bo‘limidan tekshiring.</p></div>
          <label>Name<input readOnly value={result.dnsRecord.name} /></label><label>Value<input readOnly value={result.dnsRecord.value} /></label>
          <button className="button primary" type="button" onClick={() => void copy(result.dnsRecord.value, "dns")}><Clipboard size={15} />{copied === "dns" ? "Nusxalandi" : "TXT qiymatini nusxalash"}</button>
        </section>
        <div className="modal-actions"><button className="button subtle" type="button" onClick={onClose}>Yopish</button></div>
      </div> : <form className="modal-body form-stack tenant-onboard-form" onSubmit={submit}>
        <p className="muted">POS/kassa va smena hisobi asosiy qism bo‘lib qoladi. Tekshiruvlar tugaguncha restoran tayyorlanmoqda holatida yaratiladi.</p>
        <div className="tenant-provision-grid">
          <label>Restoran nomi<input autoFocus value={values.name} onChange={(event) => update("name", event.target.value)} required minLength={2} maxLength={120} /></label>
          <label>Restoran kodi<input value={values.code} onChange={(event) => update("code", event.target.value.toUpperCase())} required minLength={2} maxLength={32} pattern={tenantCodePattern} placeholder="OQTEPA" /></label>
          <label>Restoran telefoni<input type="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} maxLength={40} /></label>
          <label>Restoran emaili<input type="email" value={values.email} onChange={(event) => update("email", event.target.value)} maxLength={254} /></label>
          <label className="tenant-field-wide">Manzil<input value={values.address} onChange={(event) => update("address", event.target.value)} maxLength={240} /></label>
          <label>Yuridik nomi<input value={values.legalName} onChange={(event) => update("legalName", event.target.value)} maxLength={160} /></label>
          <label>STIR<input value={values.taxId} onChange={(event) => update("taxId", event.target.value)} maxLength={32} /></label>
        </div>
        <div className="tenant-form-divider"><strong>Owner hisobi</strong><span>Parol kamida 12 belgidan iborat.</span></div>
        <div className="tenant-provision-grid">
          <label>Owner ism-familiyasi<input value={values.ownerName} onChange={(event) => update("ownerName", event.target.value)} required minLength={2} maxLength={120} /></label>
          <label>Owner login: email yoki telefon<input value={values.ownerLogin} onChange={(event) => update("ownerLogin", event.target.value)} required maxLength={254} autoComplete="username" autoCapitalize="none" /></label>
          <label>Owner paroli<input type="password" value={values.ownerPassword} onChange={(event) => update("ownerPassword", event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /></label>
        </div>
        <div className="tenant-form-divider"><strong>Birinchi filial va domen</strong><span>Domen: slug.mazetto.uz</span></div>
        <div className="tenant-provision-grid">
          <label>Filial nomi<input value={values.branchName} onChange={(event) => update("branchName", event.target.value)} required minLength={2} maxLength={120} /></label>
          <label>Filial kodi<input value={values.branchCode} onChange={(event) => update("branchCode", event.target.value)} required minLength={2} maxLength={32} pattern={tenantCodePattern} placeholder="MAIN" aria-describedby="tenant-branch-code-hint" /><small className="muted" id="tenant-branch-code-hint">Kod avtomatik taklif qilinadi; bo‘shliq _ ga almashtiriladi. Masalan: BEST FOODS → BEST_FOODS.</small></label>
          <label>Subdomen<input value={values.subdomain} onChange={(event) => update("subdomain", event.target.value.toLowerCase())} required minLength={2} maxLength={63} pattern={tenantSubdomainPattern} placeholder="oqtepa" autoCapitalize="none" autoCorrect="off" /></label>
          <div className="tenant-domain-preview"><small>Admin panel manzili</small><strong>https://{values.subdomain || "restoran"}.mazetto.uz</strong></div>
        </div>
        <div className="tenant-form-divider"><strong>Funksiyalar</strong><span>Keyin ham istalgan vaqtda yoqib/o‘chirish mumkin.</span></div>
        <div className="tenant-core-feature"><Check size={16} /><span><strong>Kassa, POS, smena va buyurtma tarixi</strong><small>Asosiy panel tarkibi. Doim yoqilgan.</small></span></div>
        <div className="tenant-feature-groups">{groups.map((group) => <fieldset className="tenant-feature-group" key={group}><legend>{group}</legend>{featureCatalog.filter((feature) => feature.group === group).map((feature) => <label className="tenant-feature-option" key={feature.code}><input type="checkbox" checked={enabled.includes(feature.code)} onChange={(event) => toggleFeature(feature.code, event.target.checked)} /><span><strong>{feature.name}</strong><small>{feature.description}</small></span></label>)}</fieldset>)}</div>
        <p className="muted">Mijozlar sayti ixtiyoriy. Belgilash saytni joylashtirmaydi: domen, web-xizmat va routing alohida sozlanadi. Televizor rejimi oshxona paneliga bog‘liq; uni o‘chirish oshxona paneliga ta’sir qilmaydi.</p>
        <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose} disabled={busy}>Bekor qilish</button><button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}{busy ? "Yaratilmoqda..." : "Restoran va owner yaratish"}</button></div>
      </form>}
    </div>
  </div>;
}

export function TenantFeatureEditor({ tenantId }: { tenantId: string }) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const path = "/platform/tenants/" + encodeURIComponent(tenantId) + "/features";
    void apiRequest<Feature[]>(path).then((loaded) => {
      if (!active) return;
      setFeatures(loaded);
      setDraft(loaded.filter((feature) => feature.isEnabled).map((feature) => feature.code));
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Funksiyalar yuklanmadi.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  const current = useMemo(() => features.filter((feature) => feature.isEnabled).map((feature) => feature.code), [features]);
  const dirty = [...draft].sort().join("|") !== [...current].sort().join("|");
  function toggle(code: string, checked: boolean) {
    setDraft((currentDraft) => {
      const next = new Set(currentDraft);
      if (checked) next.add(code); else next.delete(code);
      if (code === "WEB_ORDERS" && checked) next.add("CUSTOMER_WEB");
      if (code === "CUSTOMER_WEB" && !checked) next.delete("WEB_ORDERS");
      if (code === "TV_DISPLAY" && checked) next.add("KITCHEN_DISPLAY");
      if (code === "KITCHEN_DISPLAY" && !checked) next.delete("TV_DISPLAY");
      return [...next];
    });
  }
  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const path = "/platform/tenants/" + encodeURIComponent(tenantId) + "/features";
      const updated = await apiRequest<Feature[]>(path, { method: "PUT", body: JSON.stringify({ enabledCodes: draft }) });
      setFeatures(updated); setDraft(updated.filter((feature) => feature.isEnabled).map((feature) => feature.code));
      setNotice("Restoran funksiyalari saqlandi.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Funksiyalar saqlanmadi.");
    } finally { setSaving(false); }
  }
  const groups = [...new Set(features.map((feature) => feature.group))];
  return <section className="section tenant-feature-panel">
    <div className="section-head"><div><h2>Restoran funksiyalari</h2><p className="muted">Saqlangan sozlamalar yangi so‘rovlardan boshlab API’da tekshiriladi.</p></div><button className="button primary" type="button" onClick={() => void save()} disabled={loading || saving || !dirty}><Save size={15} />{saving ? "Saqlanmoqda..." : "O‘zgarishlarni saqlash"}</button></div>
    {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="alert" role="status">{notice}</div>}
    {loading ? <p className="muted">Funksiyalar yuklanmoqda...</p> : <>
      <div className="tenant-core-feature"><Check size={16} /><span><strong>Kassa, POS, smena va buyurtmalar tarixi</strong><small>Asosiy imkoniyatlar. O‘chirib bo‘lmaydi.</small></span></div>
      <div className="tenant-feature-groups">{groups.map((group) => <fieldset className="tenant-feature-group" key={group}><legend>{group}</legend>{features.filter((feature) => feature.group === group).map((feature) => <label className="tenant-feature-option" key={feature.code}><input type="checkbox" checked={draft.includes(feature.code)} onChange={(event) => toggle(feature.code, event.target.checked)} /><span><strong>{feature.name}</strong><small>{feature.description}</small></span></label>)}</fieldset>)}</div>
      <p className="muted">Saytni yoqish bilan hosting, DNS, server routing va TLS avtomatik yaratilmaydi.</p>
    </>}
  </section>;
}


type TenantTelegramSettings = {
  tenant: { id: string; code: string; status: string };
  telegramOrdersEnabled: boolean;
  staffChatId: string;
  updatedAt: string | null;
  customerBotUsername: string | null;
  customerBotLink: string | null;
  botConfigured: boolean;
  staffNotificationsReady: boolean;
  ready: boolean;
};

export function TenantTelegramEditor({ tenantId }: { tenantId: string }) {
  const [settings, setSettings] = useState<TenantTelegramSettings | null>(null);
  const [staffChatId, setStaffChatId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void apiRequest<TenantTelegramSettings>(`/platform/tenants/${encodeURIComponent(tenantId)}/telegram`)
      .then((loaded) => {
        if (!active) return;
        setSettings(loaded);
        setStaffChatId(loaded.staffChatId);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Telegram sozlamalari yuklanmadi.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId]);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<TenantTelegramSettings>(`/platform/tenants/${encodeURIComponent(tenantId)}/telegram`, {
        method: "PUT",
        body: JSON.stringify({ staffChatId: staffChatId.trim() || null }),
      });
      setSettings(updated);
      setStaffChatId(updated.staffChatId);
      setNotice("Telegram sozlamalari saqlandi va auditga yozildi.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Telegram sozlamalari saqlanmadi.");
    } finally {
      setSaving(false);
    }
  }

  const status = settings?.ready ? "Konfiguratsiya to‘liq" : settings?.staffChatId ? "Tekshiruv kutilmoqda" : "Sozlanmagan";
  return <section className="section tenant-feature-panel">
    <div className="section-head"><div><h2>Telegram buyurtma kanali</h2><p className="muted">Umumiy Telegram bot backend’ga ulanadi; buyurtma va mijoz konteksti restoran domeni/kodi bo‘yicha serverda ajratiladi.</p></div><span className="section-meta">{loading ? "Yuklanmoqda..." : status}</span></div>
    {error && <div className="alert" role="alert">{error}</div>}
    {notice && <div className="alert" role="status">{notice}</div>}
    {loading ? <p className="muted">Telegram sozlamalari yuklanmoqda...</p> : settings && <>
      <div className="tenant-setup-steps">
        <div className="tenant-setup-row"><span className={settings.customerBotLink ? "tenant-setup-icon ready" : "tenant-setup-icon pending"}>{settings.customerBotLink ? <Check size={16} /> : <X size={16} />}</span><div><strong>Mijoz botiga kirish</strong><p>{settings.customerBotLink ? `Bot: @${settings.customerBotUsername}` : "Bot username serverda sozlanmagan."}</p></div>{settings.customerBotLink && <a className="button subtle" href={settings.customerBotLink} target="_blank" rel="noreferrer"><ExternalLink size={15} />Bot havolasi</a>}</div>
        <div className="tenant-setup-row"><span className={settings.botConfigured ? "tenant-setup-icon ready" : "tenant-setup-icon pending"}>{settings.botConfigured ? <Check size={16} /> : <X size={16} />}</span><div><strong>Server bot sozlamalari</strong><p>{settings.botConfigured ? "Bot tokeni va webhook siri serverda bor. Webhook manzili Telegram’da alohida read-only smoke bilan tekshiriladi." : "Bot tokeni yoki webhook siri serverda sozlanmagan."}</p></div></div>
        <div className="tenant-setup-row"><span className={settings.staffNotificationsReady ? "tenant-setup-icon ready" : "tenant-setup-icon pending"}>{settings.staffNotificationsReady ? <Check size={16} /> : <X size={16} />}</span><div><strong>Xodimlar buyurtma guruhi</strong><p>Guruhga mijoz botini qo‘shing, /staffid yuboring va qaytgan Chat ID ni kiriting. Bot guruhda xabar yubora olishi kerak.</p></div></div>
      </div>
      <label className="tenant-chat-id-field">Xodimlar guruhi Chat ID<input value={staffChatId} onChange={(event) => setStaffChatId(event.target.value)} inputMode="numeric" placeholder="-1001234567890" maxLength={20} /></label>
      <div className="section-head"><p className="muted">Telegram buyurtmalari: {settings.telegramOrdersEnabled ? "yoqilgan" : "o‘chiq"}. Yoqishdan oldin xodimlar guruhi sozlanadi; customer bot havolasi t_{settings.tenant.code.toLowerCase()} kodini olib yuradi.</p><button className="button primary" type="button" onClick={() => void save()} disabled={saving || staffChatId.trim() === settings.staffChatId}><Save size={15} />{saving ? "Saqlanmoqda..." : "Telegram sozlamasini saqlash"}</button></div>
    </>}
  </section>;
}


export function TenantOwnerPasswordResetModal({
  tenantId,
  target,
  tenantStatus,
  onClose,
  onReset,
}: {
  tenantId: string;
  target: TenantMembership;
  tenantStatus: TenantRegistryEntry["status"];
  onClose: () => void;
  onReset: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const accountName = target.user.displayName || target.user.email || target.user.phone || "Restoran egasi";
  const login = target.user.email || target.user.phone || "Login ko‘rsatilmagan";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("Yangi parol kamida 12 ta belgidan iborat bo‘lsin.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Yangi parollar mos kelmadi.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/platform/tenants/${encodeURIComponent(tenantId)}/owner-accounts/${encodeURIComponent(target.userId)}/password-reset`, {
        method: "POST",
        body: JSON.stringify({ newPassword, confirmation }),
      });
      setSavedPassword(newPassword);
      setNewPassword("");
      setConfirmation("");
      onReset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner parolini yangilab bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(savedPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Nusxalashga ruxsat berilmadi. Parolni belgilang va qo‘lda nusxalang.");
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="owner-password-reset-title">
      <div className="modal-head">
        <div><p className="eyebrow">OWNER HISOBI</p><h2 id="owner-password-reset-title">Parolni tiklash</h2></div>
        <button className="icon-button" type="button" aria-label="Yopish" onClick={onClose} disabled={busy}><X size={20} /></button>
      </div>
      {error && <div className="alert" role="alert" style={{ margin: "12px 22px 0" }}>{error}</div>}
      {savedPassword ? <div className="modal-body form-stack owner-password-result">
        <div className="notice" role="status"><Check size={17} />{accountName} hisobiga yangi parol o‘rnatildi.</div>
        <p className="muted">Bu parol faqat shu oynada ko‘rsatiladi. Uni egasiga xavfsiz yo‘l bilan yuboring. Shu loginning barcha faol sessiyalari, jumladan boshqa restoranlardagi sessiyalari ham tugatiladi. Restoran holati o‘zgarmaydi.</p>
        <div className="owner-password-once"><code>{savedPassword}</code><button className="button subtle" type="button" onClick={() => void copyPassword()}><Clipboard size={15} />{copied ? "Nusxalandi" : "Parolni nusxalash"}</button></div>
        <p className="muted">Egasiga tizimga kirgach shaxsiy kabinetidagi “Parolni almashtirish” bo‘limidan o‘zi uchun yangi parol o‘rnatishni ayting.</p>
        <div className="modal-actions"><button className="button primary" type="button" onClick={onClose}>Tushunarli</button></div>
      </div> : <form className="modal-body form-stack" onSubmit={submit}>
        <div className="owner-password-account"><strong>{accountName}</strong><span>{login}</span></div>
        <div className="alert" role="note"><ShieldCheck size={17} /><span>Eski parol ko‘rsatilmaydi. Bu amal yangi parol o‘rnatadi va hisobga tegishli barcha faol sessiyalarni yakunlaydi.</span></div>
        <label>Yangi parol<input autoFocus type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required minLength={12} maxLength={128} /></label>
        <label>Yangi parolni takrorlang<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={12} maxLength={128} /></label>
        <p className="muted">Kamida 12 ta belgi ishlating. Parol audit jurnaliga yozilmaydi.</p>
        <div className="modal-actions"><button className="button subtle" type="button" onClick={onClose} disabled={busy}>Bekor qilish</button><button className="button primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={15} />}{busy ? "Yangilanmoqda..." : "Yangi parol o‘rnatish"}</button></div>
      </form>}
    </div>
  </div>;
}
