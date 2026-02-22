"use client";

import { useRouter } from "next/navigation";
import VerificationWizard from "@/components/VerificationWizard";

export default function VerifyPage() {
  const router = useRouter();

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

