"use client";

import { useRouter } from "next/navigation";
import VerificationWizard from "@/components/VerificationWizard";

export default function VerifyPage() {
  const router = useRouter();

  return (
    <main className="min-h-dvh px-4 pb-10 pt-8">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,1)_76%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_25%,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0)_62%)]" />

          <div className="relative px-5 pb-6 pt-6">
            <VerificationWizard
              onVerified={() => {
                router.push("/");
              }}
              onCancel={() => {
                router.push("/");
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

