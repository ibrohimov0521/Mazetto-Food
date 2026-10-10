"use client";

import {
  Check,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../admin-ui/button";
import { Tabs, type TabItem } from "../admin-ui/tabs";
import { runPrinterTestsIndependently } from "../../lib/printer-test-batch.mjs";

type ReceiptKind = "RECEIPT" | "KITCHEN" | "CANCELLATION" | "REFUND";
type ReceiptFieldKey =
  | "branchName" | "orderNumber" | "orderType" | "dateTime"
  | "customerName" | "customerPhone" | "address" | "itemPrices"
  | "itemModifiers" | "itemNotes" | "payments" | "total"
  | "orderNotes" | "reason";
type ReceiptDocument = {
  title: string;
  titleEnabled: boolean;
  density: "COMPACT" | "NORMAL";
  businessName: string;
  businessNameEnabled: boolean;
  logoEnabled: boolean;
  fontSizePx: number;
  titleSizePx: number;
  lineHeight: number;
  fields: Record<ReceiptFieldKey, boolean>;
  headerLines: string[];
  footerLines: string[];
};
type ReceiptProfile = {
  schemaVersion: number;
  businessName: string;
  commonHeaderLines: string[];
  commonFooterLines: string[];
  documents: Record<ReceiptKind, ReceiptDocument>;
};
type SelectedPrinter = {
  name: string;
  displayName: string;
  roles: string[];
  paperFormat: "ROLL" | "A4" | "LABEL";
  paperWidthMm: number | "";
  paperHeightMm?: number | "";
};
type AvailablePrinter = {
  name: string;
  displayName: string;
  description: string | null;
  status: number;
  isDefault: boolean;
};
type ManagedPrinter = { id: string; name: string; host: string; port: number };

const printRoles = [
  { value: "RECEIPT", label: "Mijoz cheki" },
  { value: "KITCHEN", label: "Oshxona" },
  { value: "CANCELLATION", label: "Bekor qilish" },
  { value: "REFUND", label: "Pul qaytarish" },
  { value: "BAR", label: "Bar" },
];

const receiptTabs: Array<{ key: ReceiptKind; label: string }> = [
  { key: "RECEIPT", label: "Mijoz cheki" },
  { key: "KITCHEN", label: "Oshxona" },
  { key: "CANCELLATION", label: "Bekor qilish" },
  { key: "REFUND", label: "Pul qaytarish" },
];

const fieldLabels: Array<{ key: ReceiptFieldKey; label: string }> = [
  { key: "branchName", label: "Filial nomi" },
  { key: "orderNumber", label: "Buyurtma raqami" },
  { key: "orderType", label: "Buyurtma turi" },
  { key: "dateTime", label: "Sana va vaqt" },
  { key: "customerName", label: "Mijoz ismi" },
  { key: "customerPhone", label: "Mijoz telefoni" },
  { key: "address", label: "Manzil" },
  { key: "itemPrices", label: "Mahsulot narxlari" },
  { key: "itemModifiers", label: "Mahsulot qo‘shimchalari" },
  { key: "itemNotes", label: "Mahsulot izohlari" },
  { key: "payments", label: "To‘lovlar" },
  { key: "total", label: "Jami summa" },
  { key: "orderNotes", label: "Buyurtma izohi" },
  { key: "reason", label: "Bekor qilish/qaytarish sababi" },
];

const receiptTabItems: TabItem[] = receiptTabs.map(({ key, label }) => ({ key, label }));

export function DesktopPrintSettings() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeTab, setActiveTab] = useState("printers");
  const [kind, setKind] = useState<ReceiptKind>("RECEIPT");
  const [availablePrinters, setAvailablePrinters] = useState<AvailablePrinter[]>([]);
  const [selectedPrinters, setSelectedPrinters] = useState<SelectedPrinter[]>([]);
  const [printerHost, setPrinterHost] = useState("");
  const [printerPort, setPrinterPort] = useState("9100");
  const [managedPrinters, setManagedPrinters] = useState<ManagedPrinter[]>([]);
  const [profile, setProfile] = useState<ReceiptProfile | null>(null);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewWidth, setPreviewWidth] = useState(80);
  const [printerResults, setPrinterResults] = useState<Array<{ name: string; ok: boolean; message: string }>>([]);
  const [receiptDirty, setReceiptDirty] = useState(false);
  const previewSequence = useRef(0);

  useEffect(() => {
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop) return;
    void Promise.all([
      loadSystemPrinters(),
      window.mazettoDesktop?.receiptProfiles?.load(),
    ]).then(([, loadedProfile]) => {
      if (loadedProfile) setProfile(loadedProfile);
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Sozlamalarni yuklab bo‘lmadi.");
    });
  }, []);

  useEffect(() => {
    if (!isDesktop || activeTab !== "design" || !profile) return;
    const sequence = ++previewSequence.current;
    const timer = window.setTimeout(() => {
      void window.mazettoDesktop?.receiptProfiles?.preview({
        kind,
        profile,
        paperWidthMm: previewWidth,
      }).then((html) => {
        if (sequence === previewSequence.current) setPreviewHtml(html);
      }).catch(() => {
        if (sequence === previewSequence.current) setPreviewHtml("");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeTab, isDesktop, kind, previewWidth, profile]);

  async function loadSystemPrinters(): Promise<void> {
    const printer = window.mazettoDesktop?.printer;
    if (!printer) return;
    setPrinterBusy(true);
    setMessage("");
    try {
      const [available, settings] = await Promise.all([printer.listSystem(), printer.status()]);
      setAvailablePrinters(available);
      setManagedPrinters(settings.managedPrinterDetails ?? []);
      setSelectedPrinters((settings.systemPrinters ?? []).map((entry) => ({
        ...entry,
        paperFormat: entry.paperFormat ?? "ROLL",
        paperWidthMm: entry.paperWidthMm ?? 80,
      })));
      setPrinterHost(settings.host ?? "");
      setPrinterPort(String(settings.port));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Windows printerlari topilmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  function toggleSystemPrinter(printer: AvailablePrinter): void {
    setSelectedPrinters((current) => {
      if (current.some((entry) => entry.name === printer.name)) {
        return current.filter((entry) => entry.name !== printer.name);
      }
      const isLabel = /\bgodex\b/i.test(`${printer.name} ${printer.displayName}`);
      return [...current, {
        name: printer.name,
        displayName: printer.displayName,
        roles: ["RECEIPT"],
        paperFormat: isLabel ? "LABEL" : "ROLL",
        paperWidthMm: isLabel ? 90 : 80,
        ...(isLabel ? { paperHeightMm: 80 } : {}),
      }];
    });
  }

  function updateSelectedPrinter(name: string, update: Partial<SelectedPrinter>): void {
    setSelectedPrinters((current) => current.map((entry) =>
      entry.name === name ? { ...entry, ...update } : entry,
    ));
  }

  function togglePrinterRole(name: string, role: string): void {
    setSelectedPrinters((current) => current.map((entry) => {
      if (entry.name !== name) return entry;
      const roles = entry.roles.includes(role)
        ? entry.roles.filter((value) => value !== role)
        : [...entry.roles, role];
      return { ...entry, roles };
    }).filter((entry) => entry.roles.length));
  }

  async function saveSystemPrinters(test = false): Promise<void> {
    const printer = window.mazettoDesktop?.printer;
    if (!printer) return;
    const invalid = selectedPrinters.find((entry) => {
      const width = Number(entry.paperWidthMm);
      const height = Number(entry.paperHeightMm ?? 80);
      return !Number.isInteger(width) || width < 30 || width > 300 ||
        (entry.paperFormat === "LABEL" && (!Number.isInteger(height) || height < 20 || height > 300));
    });
    if (invalid) {
      setMessage("Qog‘oz kengligini 30–300 mm, yorliq balandligini 20–300 mm oralig‘ida kiriting.");
      return;
    }
    setPrinterBusy(true);
    setMessage("");
    setPrinterResults([]);
    try {
      const targets = selectedPrinters.map(({ paperHeightMm, ...entry }) => ({
        ...entry,
        paperWidthMm: Number(entry.paperWidthMm),
        ...(entry.paperFormat === "LABEL" ? { paperHeightMm: Number(paperHeightMm ?? 80) } : {}),
      }));
      await printer.saveSystem({ printers: targets });
      if (test) {
        const results = await runPrinterTestsIndependently(
          targets,
          async (target) => {
            await printer.testSystem({
              name: target.name,
              role: target.roles[0] ?? "RECEIPT",
              paperFormat: target.paperFormat,
              paperWidthMm: target.paperWidthMm,
              ...(target.paperHeightMm == null ? {} : { paperHeightMm: target.paperHeightMm }),
            });
          },
          setPrinterResults,
        );
        const passed = results.filter((result) => result.ok).length;
        setMessage(results.length
          ? `${passed}/${results.length} printer test buyrug‘i Windows’ga yuborildi; qog‘oz chiqqanini tekshiring.`
          : "Test uchun printer tanlanmagan.");
      } else {
        setMessage("Printer tanlovi saqlandi.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Printer sozlamalari saqlanmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  async function saveNetworkPrinter(test = false): Promise<void> {
    const printer = window.mazettoDesktop?.printer;
    if (!printer) return;
    setPrinterBusy(true);
    setMessage("");
    try {
      const settings = await printer.save({ host: printerHost, port: Number(printerPort) });
      if (test) await printer.test();
      setPrinterHost(settings.host ?? "");
      setPrinterPort(String(settings.port));
      setMessage(test ? "Tarmoq printeri bilan ulanish tasdiqlandi." : "Tarmoq printeri saqlandi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tarmoq printeri sozlanmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  async function testManagedPrinters(): Promise<void> {
    const printer = window.mazettoDesktop?.printer;
    if (!printer) return;
    setPrinterBusy(true);
    setMessage("");
    try {
      const results = await printer.testManaged();
      const passed = results.filter((result) => result.ok).length;
      setMessage(results.length
        ? `${passed}/${results.length} filial printeri javob berdi.`
        : "Tekshiriladigan filial printeri topilmadi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Filial printerlarini tekshirib bo‘lmadi.");
    } finally {
      setPrinterBusy(false);
    }
  }

  function updateDocument(update: (document: ReceiptDocument) => ReceiptDocument): void {
    setProfile((current) => current ? {
      ...current,
      documents: {
        ...current.documents,
        [kind]: update(current.documents[kind]),
      },
    } : current);
    setReceiptDirty(true);
  }

  async function saveProfile(): Promise<void> {
    const bridge = window.mazettoDesktop?.receiptProfiles;
    if (!bridge || !profile) return;
    setProfileBusy(true);
    setMessage("");
    try {
      setProfile(await bridge.save(profile));
      setReceiptDirty(false);
      setMessage("Chek ko‘rinishi ushbu kompyuterda saqlandi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chek ko‘rinishi saqlanmadi.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function resetProfile(): Promise<void> {
    const bridge = window.mazettoDesktop?.receiptProfiles;
    if (!bridge || !window.confirm("Barcha chek sozlamalarini standart ko‘rinishga qaytaraymi?")) return;
    setProfileBusy(true);
    setMessage("");
    try {
      const defaults = await bridge.reset();
      setProfile(defaults);
      setReceiptDirty(false);
      setMessage("Chek sozlamalari standart holatga qaytarildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Standart sozlamalar tiklanmadi.");
    } finally {
      setProfileBusy(false);
    }
  }

  if (!isDesktop) {
    return (
      <div className="rounded-mz-card border border-mz-border bg-mz-surface p-5 text-sm text-mz-text-muted">
        Printer va chek maketi sozlamalari Windows printerlariga bog‘langan. Ularni MAZETTO Desktop ilovasida oching.
      </div>
    );
  }

  const activeDocument = profile?.documents[kind];
  const topTabs: TabItem[] = [
    { key: "printers", label: "Printer ulanishlari" },
    { key: "design", label: "Chek ko‘rinishi" },
  ];

  return (
    <div className="grid gap-5">
      <Tabs active={activeTab} items={topTabs} label="Chop etish sozlamalari" onChange={setActiveTab} />

      {activeTab === "printers" ? (
        <section aria-label="Windows printer sozlamalari" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-mz-text">Kompyuterga o‘rnatilgan printerlar</h2>
              <p className="mt-1 text-sm text-mz-text-muted">USB, Bluetooth yoki tarmoq printerini Windows drayveri orqali tanlang.</p>
            </div>
            <Button isLoading={printerBusy} onClick={() => void loadSystemPrinters()} size="sm" variant="ghost">
              <RefreshCw aria-hidden="true" size={15} /> Yangilash
            </Button>
          </div>

          {availablePrinters.length ? availablePrinters.map((printer) => {
            const selected = selectedPrinters.find((entry) => entry.name === printer.name);
            return (
              <article className="rounded-mz-card border border-mz-border bg-mz-surface p-4" key={printer.name}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input checked={Boolean(selected)} className="mt-1 h-4 w-4 accent-mz-primary" onChange={() => toggleSystemPrinter(printer)} type="checkbox" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-mz-text">{printer.displayName}</span>
                    <span className="mt-0.5 block text-xs text-mz-text-muted">
                      {printer.isDefault ? "Windows asosiy printeri" : printer.description || printer.name}
                    </span>
                  </span>
                  {selected ? <Check aria-label="Tanlangan" className="text-mz-success" size={17} /> : null}
                </label>
                {selected ? (
                  <div className="mt-4 grid gap-4 border-t border-mz-border pt-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <fieldset className="grid gap-2">
                      <legend className="mb-2 text-xs font-semibold text-mz-text-muted">Qaysi cheklarni shu printerga yuborish kerak</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {printRoles.map((role) => (
                          <label className="flex items-center gap-2 text-sm text-mz-text" key={role.value}>
                            <input checked={selected.roles.includes(role.value)} className="h-4 w-4 accent-mz-primary" onChange={() => togglePrinterRole(printer.name, role.value)} type="checkbox" />
                            {role.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <label className="grid gap-1 text-xs font-semibold text-mz-text">
                        Qog‘oz turi
                        <select
                          className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal"
                          onChange={(event) => {
                            const value = event.target.value as SelectedPrinter["paperFormat"];
                            const width = value === "A4" ? 210 : value === "LABEL" ? (selected.paperWidthMm === 210 ? 90 : selected.paperWidthMm) : (selected.paperWidthMm === 210 ? 80 : selected.paperWidthMm);
                            updateSelectedPrinter(printer.name, {
                              paperFormat: value,
                              paperWidthMm: width,
                              paperHeightMm: value === "LABEL" ? (selected.paperHeightMm ?? 80) : "",
                            });
                          }}
                          value={selected.paperFormat}
                        >
                          <option value="ROLL">Termal rulon</option>
                          <option value="A4">A4 varaq</option>
                          <option value="LABEL">Yorliq</option>
                        </select>
                      </label>
                      {selected.paperFormat === "A4" ? (
                        <p className="self-end text-xs text-mz-text-muted">A4 · 210 × 297 mm</p>
                      ) : (
                        <label className="grid gap-1 text-xs font-semibold text-mz-text">
                          Kengligi, mm
                          <input className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" max={300} min={30} onChange={(event) => updateSelectedPrinter(printer.name, { paperWidthMm: event.target.value === "" ? "" : Number(event.target.value) })} type="number" value={selected.paperWidthMm} />
                        </label>
                      )}
                      {selected.paperFormat === "LABEL" ? (
                        <label className="grid gap-1 text-xs font-semibold text-mz-text">
                          Balandligi, mm
                          <input className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" max={300} min={20} onChange={(event) => updateSelectedPrinter(printer.name, { paperHeightMm: event.target.value === "" ? "" : Number(event.target.value) })} type="number" value={selected.paperHeightMm ?? 80} />
                        </label>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className="rounded-mz-card border border-dashed border-mz-border p-8 text-center text-sm text-mz-text-muted">
              <Printer aria-hidden="true" className="mx-auto mb-2" size={20} />
              Windows’da o‘rnatilgan printer topilmadi. Drayver o‘rnatilganini tekshirib, yangilang.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={!selectedPrinters.length} isLoading={printerBusy} onClick={() => void saveSystemPrinters(true)} size="sm" variant="ghost">Test cheki</Button>
            <Button isLoading={printerBusy} onClick={() => void saveSystemPrinters()} size="sm"><Save aria-hidden="true" size={15} /> Saqlash</Button>
          </div>

          <section aria-labelledby="network-printer-title" className="grid gap-3 border-t border-mz-border pt-4">
            <div>
              <h3 className="text-sm font-semibold text-mz-text" id="network-printer-title">Tarmoq printeri (ixtiyoriy)</h3>
              <p className="mt-1 text-xs text-mz-text-muted">Windows’da drayveri bo‘lmagan ESC/POS printer uchun IP va port kiriting. Oddiy USB printerga kerak emas.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto_auto]">
              <input aria-label="Printer IP manzili" className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm" onChange={(event) => setPrinterHost(event.target.value)} placeholder="192.168.1.50" value={printerHost} />
              <input aria-label="Printer porti" className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm" inputMode="numeric" onChange={(event) => setPrinterPort(event.target.value)} value={printerPort} />
              <Button disabled={!printerHost} isLoading={printerBusy} onClick={() => void saveNetworkPrinter()} size="sm" variant="ghost">Saqlash</Button>
              <Button disabled={!printerHost} isLoading={printerBusy} onClick={() => void saveNetworkPrinter(true)} size="sm">Sinash</Button>
            </div>
            {managedPrinters.length ? (
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-mz-text-muted">Tizimda qayd etilgan tarmoq printerlari · {managedPrinters.length}</p>
                {managedPrinters.map((entry) => <p className="text-xs text-mz-text-muted" key={entry.id}>{entry.name} · {entry.host}:{entry.port}</p>)}
                <div><Button isLoading={printerBusy} onClick={() => void testManagedPrinters()} size="sm" variant="ghost">Filial printerlarini tekshirish</Button></div>
              </div>
            ) : null}
          </section>
        </section>
      ) : (
        <section aria-label="Chek ko‘rinishi sozlamalari" className="grid gap-5">
          {!profile || !activeDocument ? (
            <div aria-busy="true" className="py-12 text-center text-sm text-mz-text-muted">Chek sozlamalari yuklanmoqda...</div>
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid content-start gap-5">
                  <section className="grid gap-4 border-b border-mz-border pb-5">
                    <h2 className="text-base font-semibold text-mz-text">Barcha cheklarga umumiy</h2>
                    <LineEditor label="Har bir chek boshidagi umumiy yozuvlar" values={profile.commonHeaderLines} onChange={(values) => { setProfile({ ...profile, commonHeaderLines: values }); setReceiptDirty(true); }} />
                    <LineEditor label="Har bir chek oxiridagi umumiy yozuvlar" values={profile.commonFooterLines} onChange={(values) => { setProfile({ ...profile, commonFooterLines: values }); setReceiptDirty(true); }} />
                  </section>

                  <section className="grid gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-mz-text">Chek turini sozlash</h2>
                      <p className="mt-1 text-sm text-mz-text-muted">Tanlangan chek turi uchun sarlavha, matn o‘lchami va chiqadigan ma’lumotlarni belgilang.</p>
                    </div>
                    <Tabs active={kind} items={receiptTabItems} label="Chek turi" onChange={(value) => setKind(value as ReceiptKind)} />
                    <fieldset className="grid gap-2">
                      <legend className="text-sm font-semibold text-mz-text">Sarlavha elementlari</legend>
                      <label className="grid gap-1 text-xs font-semibold text-mz-text">
                        Tashkilot nomi
                        <input className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" maxLength={80} onChange={(event) => updateDocument((current) => ({ ...current, businessName: event.target.value }))} value={activeDocument.businessName} />
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-mz-text">
                        <input checked={activeDocument.logoEnabled} className="h-4 w-4 accent-mz-primary" onChange={(event) => updateDocument((current) => ({ ...current, logoEnabled: event.target.checked }))} type="checkbox" />
                        Logoni chiqarish
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-mz-text">
                        <input checked={activeDocument.businessNameEnabled} className="h-4 w-4 accent-mz-primary" onChange={(event) => updateDocument((current) => ({ ...current, businessNameEnabled: event.target.checked }))} type="checkbox" />
                        Tashkilot nomini chiqarish
                      </label>
                    </fieldset>
                    <label className="grid gap-1 text-xs font-semibold text-mz-text">
                      Chek sarlavhasi
                      <input className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal disabled:opacity-50" disabled={!activeDocument.titleEnabled} maxLength={80} onChange={(event) => updateDocument((current) => ({ ...current, title: event.target.value }))} value={activeDocument.title} />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-mz-text">
                      <input checked={activeDocument.titleEnabled} className="h-4 w-4 accent-mz-primary" onChange={(event) => updateDocument((current) => ({ ...current, titleEnabled: event.target.checked }))} type="checkbox" />
                      Chek sarlavhasini chiqarish
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="grid gap-1 text-xs font-semibold text-mz-text">
                        Asosiy shrift, px
                        <input className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" max={24} min={8} onChange={(event) => updateDocument((current) => ({ ...current, fontSizePx: Number(event.target.value) }))} type="number" value={activeDocument.fontSizePx} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-mz-text">
                        Sarlavha, px
                        <input className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" max={36} min={10} onChange={(event) => updateDocument((current) => ({ ...current, titleSizePx: Number(event.target.value) }))} type="number" value={activeDocument.titleSizePx} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-mz-text">
                        Joylashuv zichligi
                        <select className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" onChange={(event) => updateDocument((current) => ({ ...current, density: event.target.value as ReceiptDocument["density"] }))} value={activeDocument.density}>
                          <option value="NORMAL">Standart</option><option value="COMPACT">Zich</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-mz-text">
                        Qator oralig‘i
                        <select className="min-h-10 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" onChange={(event) => updateDocument((current) => ({ ...current, lineHeight: Number(event.target.value) }))} value={activeDocument.lineHeight}>
                          <option value={1}>Zich</option><option value={1.3}>O‘rtacha</option><option value={1.6}>Keng</option><option value={2}>Juda keng</option>
                        </select>
                      </label>
                    </div>

                    <fieldset className="grid gap-2">
                      <legend className="mb-1 text-sm font-semibold text-mz-text">Chekda ko‘rinadigan ma’lumotlar</legend>
                      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                        {fieldLabels.map((field) => (
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-mz-text" key={field.key}>
                            <input checked={activeDocument.fields[field.key]} className="h-4 w-4 accent-mz-primary" onChange={(event) => updateDocument((current) => ({ ...current, fields: { ...current.fields, [field.key]: event.target.checked } }))} type="checkbox" />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <LineEditor label="Faqat shu chek boshidagi qo‘shimcha yozuvlar" values={activeDocument.headerLines} onChange={(values) => updateDocument((current) => ({ ...current, headerLines: values }))} />
                    <LineEditor label="Faqat shu chek oxiridagi qo‘shimcha yozuvlar" values={activeDocument.footerLines} onChange={(values) => updateDocument((current) => ({ ...current, footerLines: values }))} />
                  </section>
                </div>

                <aside className="grid content-start gap-3 xl:sticky xl:top-4 xl:self-start">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-mz-text">Jonli namuna</h2>
                    <label className="flex items-center gap-2 text-xs text-mz-text-muted">
                      Qog‘oz eni
                      <select aria-label="Namuna qog‘oz eni" className="min-h-8 rounded-mz-control border border-mz-border bg-mz-surface px-2 text-xs" onChange={(event) => setPreviewWidth(Number(event.target.value))} value={previewWidth}>
                        <option value={58}>58 mm</option><option value={80}>80 mm</option><option value={90}>90 mm</option><option value={102}>102 mm</option><option value={210}>A4</option>
                      </select>
                    </label>
                  </div>
                  <p className="text-xs text-mz-text-muted">Qog‘oz eni printer sozlamasidan olinadi. Bu yerda maketning namuna ko‘rinishi.</p>
                  <div className="overflow-hidden rounded-mz-card border border-mz-border bg-white p-2">
                    {previewHtml ? <iframe aria-label="Chek namuna maketi" className="h-[560px] w-full bg-white" sandbox="" srcDoc={previewHtml} title="Chek namuna maketi" /> : <div className="grid h-[560px] place-items-center text-sm text-mz-text-muted">Namuna yuklanmoqda...</div>}
                  </div>
                </aside>
              </div>

              <div className="grid gap-3 border-t border-mz-border pt-4 sm:flex sm:items-center sm:justify-between">
                <p aria-live="polite" className="text-sm text-mz-text-muted">{receiptDirty ? "Saqlanmagan o‘zgarishlar bor." : "Maket ushbu kompyuterda saqlanadi va oflayn chop etishda ham ishlaydi."}</p>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button disabled={!receiptDirty || profileBusy} isLoading={profileBusy} onClick={() => void saveProfile()} size="sm"><Save aria-hidden="true" size={15} /> O‘zgarishlarni saqlash</Button>
                  <Button disabled={profileBusy} isLoading={profileBusy} onClick={() => void resetProfile()} size="sm" variant="ghost"><RotateCcw aria-hidden="true" size={15} /> Standart holatga qaytarish</Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {message ? <p aria-live="polite" className="rounded-mz-control border border-mz-border bg-mz-surface p-3 text-sm text-mz-text-muted">{message}</p> : null}
      {printerResults.length ? (
        <ul aria-live="polite" className="grid gap-1 text-sm">
          {printerResults.map((result) => <li className={result.ok ? "text-mz-success" : "text-mz-danger"} key={result.name}><strong>{result.name}:</strong> {result.message}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function LineEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-semibold text-mz-text">{label}</legend>
      {values.map((value, index) => (
        <div className="flex gap-2" key={index}>
          <input aria-label={`${label}, ${index + 1}-qator`} className="min-h-10 min-w-0 flex-1 rounded-mz-control border border-mz-border bg-mz-surface px-3 text-sm font-normal" maxLength={100} onChange={(event) => onChange(values.map((line, lineIndex) => lineIndex === index ? event.target.value : line))} value={value} />
          <Button aria-label="Yozuv qatorini olib tashlash" className="shrink-0 px-2" onClick={() => onChange(values.filter((_, lineIndex) => lineIndex !== index))} size="sm" variant="ghost"><Trash2 aria-hidden="true" size={15} /></Button>
        </div>
      ))}
      <Button disabled={values.length >= 5} onClick={() => onChange([...values, ""])} size="sm" variant="ghost"><Plus aria-hidden="true" size={15} /> Yozuv qo‘shish</Button>
    </fieldset>
  );
}
