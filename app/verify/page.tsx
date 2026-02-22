"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VerificationWizard from "@/components/VerificationWizard";
import { getEventBySlug } from "@/lib/events";

function VerifyPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/";

  // Parse event slug from the return URL to look up songs for the beat challenge
  const returnUrlObj = (() => {
    try { return new URL(returnTo, "http://x"); } catch { return null; }
  })();
  const pathParts = returnUrlObj?.pathname.split("/") ?? [];
  const eventSlug = pathParts[1] === "event" ? pathParts[2] : null;

  const event = eventSlug ? getEventBySlug(eventSlug) : null;
  const songs = event?.songs ?? [];

  const verifiedUrl = returnTo.includes("?")
    ? `${returnTo}&verified=true`
    : `${returnTo}?verified=true`;

  return (
    <VerificationWizard
      returnTo={returnTo}
      songs={songs}
      onVerified={() => {
        router.push(verifiedUrl);
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
