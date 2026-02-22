"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import VerificationWizard, { type VerificationWizardProps } from "@/components/VerificationWizard";

export type SelectedTicket = {
  id: string;
  label: string;
  price: number;
};

export type VerificationOverlayProps = {
  open: boolean;
  onClose: () => void;
  onVerified: NonNullable<VerificationWizardProps["onVerified"]>;
  selectedTicket: SelectedTicket | null;
};

export default function VerificationOverlay({ open, onClose, onVerified, selectedTicket }: VerificationOverlayProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="KineticAuth verification"
          initial={reduceMotion ? undefined : { opacity: 0 }}
          animate={reduceMotion ? undefined : { opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={onClose}
          />

          <motion.div
            className="absolute inset-0 overflow-hidden"
            initial={reduceMotion ? undefined : { y: 46, opacity: 0, filter: "blur(10px)" }}
            animate={reduceMotion ? undefined : { y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={reduceMotion ? undefined : { y: 26, opacity: 0, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 210, damping: 22, mass: 0.55 }}
          >
            <div className="h-dvh px-4 py-4">
              <div className="mx-auto flex h-full w-full max-w-[560px] flex-col">
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-[30px] ring-1 ring-white/10">
                  <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(56,189,248,0.22)_0%,rgba(99,102,241,0.14)_32%,rgba(0,0,0,1)_76%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_25%,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0)_62%)]" />

                  <div className="relative flex h-full flex-col overflow-hidden px-5 pb-5 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.26em] text-white/60">SECURE CHECKOUT</p>
                        <h1 className="mt-2 text-balance text-[28px] font-semibold leading-[1.05] tracking-tight text-white">
                          KineticAuth Verification
                        </h1>
                        <p className="mt-2 text-sm text-white/65">
                          Securing{" "}
                          <span className="font-semibold text-white">
                            {selectedTicket ? `${selectedTicket.label} — $${selectedTicket.price}` : "selected ticket"}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/10"
                      >
                        Close
                      </button>
                    </div>

                    <div className="mt-4 min-h-0 flex-1 overflow-hidden">
                      <VerificationWizard onVerified={onVerified} onCancel={onClose} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

