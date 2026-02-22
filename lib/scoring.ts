export type RiskLevel = "low" | "medium" | "high";

export type DirectedTimings = {
  timeToLeft?: number;
  timeToRight?: number;
  timeToForward?: number;
};

export type MotionSample = {
  beta: number;
  gamma: number;
  t: number; // ms (performance.now)
};

export type ScoreBreakdown = {
  entropyScore: number; // 0-100
  smoothnessScore: number; // 0-100
  reactionScore: number; // 0-100
  stabilityScore: number; // 0-100
  humanConfidence: number; // 0-100
  riskLevel: RiskLevel;
};

type ScoringInput = {
  motionSamples: MotionSample[];
  directedTimings?: DirectedTimings;
  stabilityPct?: number; // 0-100 (instant)
  stabilityHoldPct?: number; // 0-100 (progress)
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function variance(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) * (x - m);
  return v / (xs.length - 1);
}

function safeDtMs(a: MotionSample, b: MotionSample) {
  const dt = b.t - a.t;
  return clamp(dt, 8, 60);
}

function bell(t: number, mu: number, sigma: number) {
  const z = (t - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function computeEntropyScore(samples: MotionSample[]) {
  if (samples.length < 8) return 12;

  const v: number[] = [];
  const a: number[] = [];
  const j: number[] = [];

  // velocity magnitude
  for (let i = 1; i < samples.length; i++) {
    const p0 = samples[i - 1]!;
    const p1 = samples[i]!;
    const dt = safeDtMs(p0, p1) / 1000;
    const dBeta = p1.beta - p0.beta;
    const dGamma = p1.gamma - p0.gamma;
    v.push(Math.hypot(dBeta, dGamma) / dt);
  }
  // acceleration magnitude
  for (let i = 1; i < v.length; i++) {
    const dt = safeDtMs(samples[i - 1]!, samples[i]!) / 1000;
    a.push(Math.abs(v[i]! - v[i - 1]!) / dt);
  }
  // jerk magnitude
  for (let i = 1; i < a.length; i++) {
    const dt = safeDtMs(samples[i]!, samples[i + 1] ?? samples[i]!) / 1000;
    j.push(Math.abs(a[i]! - a[i - 1]!) / dt);
  }

  const vVar = variance(v);
  const jMean = mean(j);

  // Map into [0..100], rewarding non-trivial dynamics but not extreme jitter.
  const dynamics = clamp((Math.log1p(vVar) / 4.2) * 100, 0, 100);
  const jerkiness = clamp((Math.log1p(jMean) / 6.0) * 100, 0, 100);

  // Too little movement looks synthetic; too much jitter looks noisy.
  const lowPenalty = clamp(22 - dynamics * 0.35, 0, 22);
  const highPenalty = clamp((jerkiness - 78) * 0.8, 0, 22);

  return clamp(0.55 * dynamics + 0.45 * jerkiness - lowPenalty - highPenalty, 0, 100);
}

function computeSmoothnessScore(samples: MotionSample[]) {
  if (samples.length < 8) return 10;

  const dirs: number[] = [];
  const speeds: number[] = [];

  for (let i = 1; i < samples.length; i++) {
    const p0 = samples[i - 1]!;
    const p1 = samples[i]!;
    const dt = safeDtMs(p0, p1) / 1000;
    const dBeta = p1.beta - p0.beta;
    const dGamma = p1.gamma - p0.gamma;
    dirs.push(Math.atan2(dBeta, dGamma));
    speeds.push(Math.hypot(dBeta, dGamma) / dt);
  }

  // Direction change variance: perfectly linear movement ≈ constant direction → low score.
  const dTheta: number[] = [];
  for (let i = 1; i < dirs.length; i++) {
    let d = dirs[i]! - dirs[i - 1]!;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    dTheta.push(Math.abs(d));
  }

  const thetaMean = mean(dTheta);
  const speedVar = variance(speeds);

  // Encourage "human-ish" micro-adjustments: some curvature + some speed variability.
  const curvature = clamp((thetaMean / 0.42) * 100, 0, 100);
  const variability = clamp((Math.log1p(speedVar) / 4.0) * 100, 0, 100);

  // Penalize dead-straight + dead-constant.
  const linearPenalty = clamp(40 - curvature * 0.55, 0, 40);
  const constantPenalty = clamp(34 - variability * 0.45, 0, 34);

  // Penalize chaotic movement too.
  const chaosPenalty = clamp((curvature - 92) * 0.9, 0, 24);

  return clamp(0.55 * curvature + 0.45 * variability - linearPenalty - constantPenalty - chaosPenalty, 0, 100);
}

function computeReactionScore(timings?: DirectedTimings) {
  const ts = [timings?.timeToLeft, timings?.timeToRight, timings?.timeToForward].filter(
    (v): v is number => typeof v === "number"
  );
  if (ts.length === 0) return 10;

  // Score each timing: too fast or too slow is suspicious. Peak around ~1.2s.
  const per = ts.map((t) => {
    if (t < 180) return 0;
    const s = bell(t, 1200, 700); // 0..1
    return clamp(s * 100, 0, 100);
  });

  // Missing timings reduce confidence.
  const missingPenalty = (3 - ts.length) * 10;
  return clamp(mean(per) - missingPenalty, 0, 100);
}

function computeStabilityScore(stabilityPct?: number, holdPct?: number) {
  const s = typeof stabilityPct === "number" ? stabilityPct : 0;
  const h = typeof holdPct === "number" ? holdPct : 0;
  // Lean on instantaneous stability; hold progress boosts slightly.
  return clamp(s * 0.85 + h * 0.15, 0, 100);
}

function toRiskLevel(conf: number): RiskLevel {
  if (conf >= 80) return "low";
  if (conf >= 55) return "medium";
  return "high";
}

export function scoreHumanConfidence(input: ScoringInput): ScoreBreakdown {
  const entropyScore = computeEntropyScore(input.motionSamples);
  const smoothnessScore = computeSmoothnessScore(input.motionSamples);
  const reactionScore = computeReactionScore(input.directedTimings);
  const stabilityScore = computeStabilityScore(input.stabilityPct, input.stabilityHoldPct);

  const wEntropy = 0.26;
  const wSmooth = 0.20;
  const wReaction = 0.24;
  const wStability = 0.30;

  const humanConfidence = clamp(
    wEntropy * entropyScore + wSmooth * smoothnessScore + wReaction * reactionScore + wStability * stabilityScore,
    0,
    100
  );

  return {
    entropyScore: Math.round(entropyScore),
    smoothnessScore: Math.round(smoothnessScore),
    reactionScore: Math.round(reactionScore),
    stabilityScore: Math.round(stabilityScore),
    humanConfidence: Math.round(humanConfidence),
    riskLevel: toRiskLevel(humanConfidence)
  };
}

