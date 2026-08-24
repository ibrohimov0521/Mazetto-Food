"use client";

export function ErpPageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_18px_60px_rgba(15,118,110,0.10)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">MAZETTO ERP</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-neutral-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.25)] transition hover:bg-emerald-700"
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center text-sm font-medium text-emerald-800">
      {title}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
    />
  );
}
