import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-black px-4 py-10">
      <div className="mx-auto w-full max-w-[430px]">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">KineticAuth</h1>
        <p className="mt-2 text-sm text-white/70">Open the new verification experience.</p>
        <Link
          href="/verification"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
        >
          Go to verification
        </Link>
      </div>
    </main>
  );
}

