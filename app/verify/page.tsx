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
    <VerificationWizard
      onVerified={() => {
        router.push("/?verified=true");
      }}
      onCancel={() => {
        router.push("/");
      }}
    />
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0f172a]" />}>
      <VerifyPageClient />
    </Suspense>
  );
}
