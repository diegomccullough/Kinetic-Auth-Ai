"use client";

import { useRouter } from "next/navigation";
import SpotlightVerification from "@/components/SpotlightVerification";

export default function VerificationPage() {
  const router = useRouter();

  return (
    <SpotlightVerification
      onVerified={() => router.push("/verified")}
      onUseVoiceVerificationInstead={() => router.push("/voice")}
    />
  );
}

