import Link from "next/link";

export default function VerifiedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-surface-elevated p-8 shadow-lg ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">You’re verified</h1>
        <Link
          href="/"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Back to tickets
        </Link>
      </div>
    </main>
  );
}

