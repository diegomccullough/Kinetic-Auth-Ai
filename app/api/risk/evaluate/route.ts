import { NextRequest, NextResponse } from "next/server";

type RiskLevel = "low" | "medium" | "high";
type StepUp = "none" | "tilt" | "beat";

type EvaluateBody = {
  traffic_load: number;
  motion_entropy_score: number;
  interaction_latency_variance: number;
  tilt_fail_count?: number;
  device_type?: string;
};

type EvaluateResponse = {
  risk_level: RiskLevel;
  reason: string;
  step_up: StepUp;
};

function isNumber01(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 0 && v <= 1;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: EvaluateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { traffic_load, motion_entropy_score, interaction_latency_variance, tilt_fail_count } = body;

  if (!isNumber01(traffic_load)) {
    return NextResponse.json(
      { error: "traffic_load must be a number between 0 and 1" },
      { status: 400 }
    );
  }
  if (!isNumber01(motion_entropy_score)) {
    return NextResponse.json(
      { error: "motion_entropy_score must be a number between 0 and 1" },
      { status: 400 }
    );
  }
  if (!isNumber01(interaction_latency_variance)) {
    return NextResponse.json(
      { error: "interaction_latency_variance must be a number between 0 and 1" },
      { status: 400 }
    );
  }

  let score = 0;
  const reasons: string[] = [];

  if (traffic_load >= 0.75) {
    score += 2;
    reasons.push("elevated traffic load");
  }
  if (motion_entropy_score <= 0.30) {
    score += 2;
    reasons.push("low motion entropy");
  }
  if (interaction_latency_variance <= 0.20) {
    score += 1;
    reasons.push("uniform interaction latency");
  }
  if (typeof tilt_fail_count === "number" && tilt_fail_count >= 1) {
    score += 1;
    reasons.push("prior tilt failure detected");
  }

  let risk_level: RiskLevel;
  if (score <= 1) {
    risk_level = "low";
  } else if (score <= 3) {
    risk_level = "medium";
  } else {
    risk_level = "high";
  }

  const step_up: StepUp = risk_level === "low" ? "none" : risk_level === "medium" ? "tilt" : "beat";

  const reason =
    reasons.length === 0
      ? "No significant risk signals detected."
      : reasons.length === 1
      ? `Risk signal: ${reasons[0]}.`
      : `Risk signals: ${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}.`;

  const result: EvaluateResponse = { risk_level, reason, step_up };
  return NextResponse.json(result, { status: 200 });
}
