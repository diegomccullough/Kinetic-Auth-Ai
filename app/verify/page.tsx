"use client";

import { useRouter } from "next/navigation";
import VerificationWizard from "@/components/VerificationWizard";

export default function VerifyPage() {
  const router = useRouter();

  return (
    <main className="app-shell">
      <div className="screen-card">
        <VerificationWizard
          onVerified={() => {
            router.push("/?verified=true");
          }}
          onCancel={() => {
            router.push("/");
          }}
        />
      </div>
    </main>
  );
}

