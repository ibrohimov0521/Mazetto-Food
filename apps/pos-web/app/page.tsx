import { MButton } from "@mazetto/ui";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-normal text-neutral-950 sm:text-4xl">
          MAZETTO FOOD POS
        </h1>
        <MButton className="mt-8 border border-neutral-300 px-4 py-2 text-sm text-neutral-900">
          Shared UI Ready
        </MButton>
      </section>
    </main>
  );
}
