"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VerificationWizard from "@/components/VerificationWizard";

function VerifyPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/";

  const verifiedUrl =
    returnTo.includes("?") ? `${returnTo}&verified=true` : `${returnTo}?verified=true`;

  return (
    <main className="min-h-dvh bg-surface px-4 py-4 sm:py-6">
      <div className="mx-auto max-w-verify">
        <div className="overflow-hidden rounded-2xl bg-surface-elevated shadow-lg sm:rounded-3xl">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-4 sm:px-6 sm:py-5">
            <h1 className="text-lg font-semibold text-white sm:text-xl">Verify your identity</h1>
            <p className="mt-1 text-sm text-white/70">Required to continue to checkout.</p>
          </div>
          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <VerificationWizard
              returnTo={returnTo}
              onVerified={() => router.push(verifiedUrl)}
              onCancel={() => router.push(returnTo)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-surface" />}>
      <VerifyPageClient />
    </Suspense>
  );
}
