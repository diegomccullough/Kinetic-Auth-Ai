"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import type { MotionSample } from "@/lib/scoring";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function computeSeries(samples: MotionSample[], seconds: number) {
  if (samples.length < 4) return [];
  const newestT = samples[samples.length - 1]!.t;
  const oldestT = newestT - seconds * 1000;
  const sliced = samples.filter((s) => s.t >= oldestT);
  if (sliced.length < 4) return [];

  const v: number[] = [];
  for (let i = 1; i < sliced.length; i++) {
    const p0 = sliced[i - 1]!;
    const p1 = sliced[i]!;
    const dt = clamp((p1.t - p0.t) / 1000, 0.008, 0.06);
    const dBeta = p1.beta - p0.beta;
    const dGamma = p1.gamma - p0.gamma;
    v.push(Math.hypot(dBeta, dGamma) / dt);
  }

  // Downsample into buckets for a stable, small HUD graph.
  const buckets = 46;
  const per = Math.max(1, Math.floor(v.length / buckets));
  const out: number[] = [];
  for (let i = 0; i < v.length; i += per) {
    let sum = 0;
    let c = 0;
    for (let j = i; j < Math.min(v.length, i + per); j++) {
      sum += v[j]!;
      c++;
    }
    out.push(c ? sum / c : 0);
  }
  return out.slice(-buckets);
}

export type MotionVarianceGraphProps = {
  samplesRef: MutableRefObject<MotionSample[]>;
  enabled: boolean;
  reduceMotion?: boolean;
  seconds?: number;
};

export default function MotionVarianceGraph({ samplesRef, enabled, reduceMotion = false, seconds = 2.6 }: MotionVarianceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDrawRef = useRef(0);

  const theme = useMemo(
    () => ({
      bg: "rgba(0,0,0,0.45)",
      grid: "rgba(255,255,255,0.07)",
      line: "rgba(56,189,248,0.95)",
      glow: "rgba(56,189,248,0.22)",
      border: "rgba(255,255,255,0.10)"
    }),
    []
  );

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = (t: number) => {
      raf = window.requestAnimationFrame(draw);
      if (reduceMotion) return;
      if (t - lastDrawRef.current < 80) return; // ~12fps
      lastDrawRef.current = t;

      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const w = Math.floor(cssW * dpr);
      const h = Math.floor(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const series = computeSeries(samplesRef.current, seconds);
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      for (let i = 1; i <= 3; i++) {
        const y = (h * i) / 4;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      if (series.length < 2) {
        // Border
        ctx.strokeStyle = theme.border;
        ctx.strokeRect(0.5 * dpr, 0.5 * dpr, w - 1 * dpr, h - 1 * dpr);
        return;
      }

      const max = Math.max(...series, 1);
      const min = Math.min(...series, 0);
      const span = Math.max(1e-6, max - min);

      const padX = 6 * dpr;
      const padY = 6 * dpr;
      const x0 = padX;
      const y0 = padY;
      const x1 = w - padX;
      const y1 = h - padY;

      const toX = (i: number) => x0 + (i / (series.length - 1)) * (x1 - x0);
      const toY = (v: number) => y1 - clamp((v - min) / span, 0, 1) * (y1 - y0);

      // Glow stroke
      ctx.strokeStyle = theme.glow;
      ctx.lineWidth = 4 * dpr;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const x = toX(i);
        const y = toY(series[i]!);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Main stroke
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const x = toX(i);
        const y = toY(series[i]!);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Border
      ctx.strokeStyle = theme.border;
      ctx.strokeRect(0.5 * dpr, 0.5 * dpr, w - 1 * dpr, h - 1 * dpr);
    };

    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [enabled, reduceMotion, samplesRef, seconds, theme]);

  return (
    <div className="rounded-xl bg-black/30 p-2 ring-1 ring-white/10 backdrop-blur">
      <p className="mb-1 text-[10px] font-semibold tracking-[0.22em] text-white/60">MOTION VARIANCE</p>
      <canvas ref={canvasRef} className="h-[46px] w-[132px] rounded-md" />
    </div>
  );
}

