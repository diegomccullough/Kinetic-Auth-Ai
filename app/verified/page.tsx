import Link from "next/link";

export default function VerifiedPage() {
  return (
    <main className="min-h-dvh bg-black px-4 py-10">
      <div className="mx-auto w-full max-w-[430px] rounded-[28px] bg-white/[0.03] px-5 py-6 ring-1 ring-white/10">
        <h1 className="text-xl font-semibold tracking-tight">Verified</h1>
        <p className="mt-2 text-sm text-white/70">Success callback fired.</p>
        <Link
          href="/verify"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
        >
          Back to verification
        </Link>
      </div>
    </main>
  );
}

