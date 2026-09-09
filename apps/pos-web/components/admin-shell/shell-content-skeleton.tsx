"use client";

/*
 * Sessiya tiklanayotgan paytdagi kontent skeleti (PHASE 6 A4).
 *
 * Ilgari guardlar `<main className="min-h-screen bg-white" />` qaytarardi —
 * ya'ni har qattiq yangilashda admin panel avval butunlay oq sahifa
 * ko'rsatardi. Endi qobiq darhol chiziladi va faqat shu joy kutadi.
 */
export function ShellContentSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Yuklanmoqda</span>

      <div className="h-8 w-64 animate-pulse rounded-mz-control bg-mz-surface-sunken" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-mz-control bg-mz-surface-sunken" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            className="h-24 animate-pulse rounded-mz-card border border-mz-border bg-mz-surface"
            key={index}
          />
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-mz-card border border-mz-border bg-mz-surface" />
    </div>
  );
}
