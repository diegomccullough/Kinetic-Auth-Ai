import Link from "next/link";
import { DEMO_MODE } from "@/lib/demoMode";

export default function VerifiedPage() {
  const demo = DEMO_MODE;
  return (
    <main className="app-shell">
      <div className="screen-card">
        <h1 className={["font-semibold tracking-tight", demo ? "text-5xl" : "text-xl"].join(" ")}>Verified</h1>
        <p className="text-sm text-white/70">Success callback fired.</p>
        <Link
          href="/verify"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
        >
          Back to verification
        </Link>
      </div>
    </main>
  );
}

