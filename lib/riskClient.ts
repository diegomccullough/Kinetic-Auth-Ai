export type RiskEvaluatePayload = {
  traffic_load: number;
  motion_entropy_score: number;
  interaction_latency_variance: number;
  tilt_fail_count?: number;
  device_type?: string;
};

export type RiskEvaluateResponse = {
  risk_level: "low" | "medium" | "high";
  reason: string;
  step_up: "none" | "tilt" | "beat";
};

export async function evaluateRisk(payload: RiskEvaluatePayload): Promise<RiskEvaluateResponse> {
  const res = await fetch("/api/risk/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Risk evaluate failed: ${res.status}`);
  }
  return res.json() as Promise<RiskEvaluateResponse>;
}
