"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { RiskLevel } from "@/lib/scoring";

function verifiedHref(returnTo: string) {
  return returnTo.includes("?") ? `${returnTo}&verified=true` : `${returnTo}?verified=true`;
}

export default function VoiceVerificationPage() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? "/";
  const reduceMotion = useReducedMotion();
  const bars = useMemo(() => Array.from({ length: 16 }, (_, i) => i), []);

  const [listening, setListening] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<null | { humanScore: number; riskLevel: RiskLevel }>(null);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  const start = () => {
    setResult(null);
    setTranscript("");
    setListening(true);

    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];

    const script = [
      "Neon",
      "city,",
      "verified.",
      "I’m",
      "here",
      "to",
      "complete",
      "step-up",
      "verification",
      "for",
      "checkout."
    ];

    script.forEach((word, i) => {
      const id = window.setTimeout(() => {
        setTranscript((t) => (t ? `${t} ${word}` : word));
        if (i === script.length - 1) setListening(false);
      }, 220 + i * 220);
      timersRef.current.push(id);
    });
  };

  const analyze = () => {
    setAnalyzing(true);
    setResult(null);

    const id = window.setTimeout(() => {
      // Simulated "Gemini" result.
      const humanScore = Math.floor(42 + Math.random() * 56); // 42..97
      const riskLevel: RiskLevel = humanScore >= 80 ? "low" : humanScore >= 55 ? "medium" : "high";
      setResult({ humanScore, riskLevel });
      setAnalyzing(false);
    }, 950);
    timersRef.current.push(id);
  };

  const passed = result ? result.riskLevel !== "high" : false;

  return (
    <main className="app-shell">
      <div className="screen-card">
        <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold leading-tight text-white sm:text-2xl">
                  Verify with your voice
                </h1>
                <p className="mt-2 text-sm text-white/70">Say the phrase when prompted.</p>
              </div>
              <Link
                href="/"
                className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/10"
              >
                Exit
              </Link>
            </div>

            <Card className="mt-6">
              <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.16)_0%,rgba(0,0,0,0)_62%)]" />
              <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-white">Say the phrase</p>
                    <p className="mt-1 text-sm text-white/65">“Neon city, verified.”</p>
                  </div>
                </div>

                <div className="mt-5 grid place-items-center">
                  <motion.button
                    type="button"
                    onClick={start}
                    disabled={listening || analyzing}
                    className={[
                      "group relative grid h-[126px] w-[126px] place-items-center rounded-[34px] ring-1 transition",
                      listening
                        ? "bg-emerald-400/10 ring-emerald-300/25"
                        : "bg-white/5 ring-white/10 hover:bg-white/10"
                    ].join(" ")}
                    initial={false}
                    animate={
                      reduceMotion
                        ? undefined
                        : listening
                          ? { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 0 90px rgba(16,185,129,0.18)", "0 0 0 rgba(0,0,0,0)"] }
                          : { boxShadow: "0 0 0 rgba(0,0,0,0)" }
                    }
                    transition={{ duration: 1.3, repeat: listening ? Infinity : 0, ease: "easeInOut" }}
                    aria-label="Start voice check"
                  >
                    <div className="absolute inset-0 rounded-[34px] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0)_62%)]" />
                    <div className="relative">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z"
                          stroke="rgba(255,255,255,0.88)"
                          strokeWidth="1.9"
                        />
                        <path
                          d="M19 11a7 7 0 0 1-14 0"
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 18v3"
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                        <path
                          d="M8 21h8"
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="absolute -bottom-8 left-1/2 w-[180px] -translate-x-1/2 text-center text-xs text-white/60">
                      <span className="font-semibold text-white/85">Start voice check</span>
                      <span className="mx-2 text-white/35">•</span>
                      <span>{listening ? "Listening…" : "Demo mode"}</span>
                    </div>
                  </motion.button>
                </div>

                <div className="mt-10">
                  <p className="text-xs font-semibold tracking-[0.22em] text-white/60">INPUT</p>
                  <div className="mt-3 flex h-16 items-end justify-between gap-1.5 rounded-2xl bg-white/[0.04] px-3 py-3 ring-1 ring-white/10">
                    {bars.map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 rounded-full bg-gradient-to-t from-emerald-300/90 to-sky-200/80"
                        initial={false}
                        animate={
                          reduceMotion
                            ? { height: 18 }
                            : listening
                              ? { height: [10, 40, 16, 52, 12] }
                              : { height: 14 + (i % 5) * 2 }
                        }
                        transition={{
                          duration: 1.5,
                          repeat: listening ? Infinity : 0,
                          ease: "easeInOut",
                          delay: i * 0.03
                        }}
                        style={{ boxShadow: "0 0 18px rgba(16,185,129,0.10)" }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-white/55">Demo only: this page doesn’t record audio yet.</p>
                </div>
              </div>
            </Card>

            <Card className="mt-3">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-white/60">TRANSCRIPT</p>
                    <p className="mt-1 text-sm text-white/65">A simulated transcript appears after you tap the mic.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript("");
                      setResult(null);
                    }}
                    className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-3 rounded-2xl bg-black/30 p-3 ring-1 ring-white/10">
                  <p className={["text-sm leading-relaxed", transcript ? "text-white/85" : "text-white/45"].join(" ")}>
                    {transcript || "Tap “Start voice check” to generate a demo transcript."}
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
                  <Button
                    onClick={analyze}
                    disabled={!transcript || listening || analyzing}
                    className={!transcript || listening || analyzing ? "opacity-60" : undefined}
                  >
                    {analyzing ? "Analyzing…" : "Analyze"}
                  </Button>

                  <AnimatePresence initial={false}>
                    {result ? (
                      <motion.div
                        key="result"
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className={[
                          "rounded-[22px] px-4 py-3 ring-1",
                          passed ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/15" : "bg-rose-500/10 text-rose-200 ring-rose-400/15"
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold tracking-[0.22em] opacity-80">GEMINI RESULT (SIM)</p>
                            <p className="mt-1 text-sm font-semibold">
                              Human score: <span className="tabular-nums">{result.humanScore}</span> • Risk:{" "}
                              <span className="capitalize">{result.riskLevel}</span>
                            </p>
                            <p className="mt-1 text-sm opacity-90">
                              {passed ? "Decision: PASS — checkout unlocked." : "Decision: HIGH RISK — step-up required."}
                            </p>
                          </div>
                          <motion.div
                            className="grid h-10 w-10 place-items-center rounded-2xl bg-black/20 ring-1 ring-white/10"
                            animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                            aria-hidden="true"
                          >
                            <div className={passed ? "h-3 w-3 rounded-full bg-emerald-300" : "h-3 w-3 rounded-full bg-rose-300"} />
                          </motion.div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {passed ? (
                            <Link
                              href="/?verified=true"
                              className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(16,185,129,0.10)]"
                            >
                              Return to checkout
                            </Link>
                          ) : (
                            <Link
                              href="/verify"
                              className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                            >
                              Back to motion verification
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </Card>

            <div className="mt-5 space-y-3">
              <Link
                href={returnTo ? `/verify?return=${encodeURIComponent(returnTo)}` : "/verify"}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-white/75 ring-1 ring-white/10 hover:bg-white/5"
              >
                Back to motion verification
              </Link>
              <Link
                href={returnTo}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Back to tickets
              </Link>
            </div>
      </div>
    </main>
  );
}

