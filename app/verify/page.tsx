"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VerificationWizard from "@/components/VerificationWizard";
import { getEventBySlug } from "@/lib/events";

// Simulated high-traffic threshold — in a real app this would come from an API
const SIMULATED_QUEUE_SIZE = 12483;
const HIGH_TRAFFIC_THRESHOLD = 10000;

function VerifyPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/";

  // Parse event slug and qty from the return URL so we can pass context to the wizard
  const returnUrlObj = (() => {
    try { return new URL(returnTo, "http://x"); } catch { return null; }
  })();
  const pathParts = returnUrlObj?.pathname.split("/") ?? [];
  // URL shape: /event/[slug] or /event/[slug]/seats
  const eventSlug = pathParts[1] === "event" ? pathParts[2] : null;
  const qty = Number(returnUrlObj?.searchParams.get("qty") ?? 1);

  const event = eventSlug ? getEventBySlug(eventSlug) : null;
  const songs = event?.songs ?? [];
  const highTraffic = SIMULATED_QUEUE_SIZE >= HIGH_TRAFFIC_THRESHOLD;

  const verifiedUrl = returnTo.includes("?")
    ? `${returnTo}&verified=true`
    : `${returnTo}?verified=true`;

  return (
    <VerificationWizard
      returnTo={returnTo}
      songs={songs}
      highTraffic={highTraffic}
      ticketQty={qty}
      onVerified={() => {
        router.push(verifiedUrl);
      }}
      onCancel={() => {
        router.back();
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
