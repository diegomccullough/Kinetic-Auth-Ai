import { NextRequest, NextResponse } from "next/server";

type RiskLevel = "low" | "medium" | "high";
type StepUp = "none" | "tilt" | "beat";

type EvaluateBody = {
  traffic_load: number;
  motion_entropy_score: number;
  interaction_latency_variance: number;
  shake_accuracy?: number;
  device_type?: string;
};

type EvaluateResponse = {
  risk_level: RiskLevel;
  reason: string;
  step_up: StepUp;
};

function isValidNumber(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: EvaluateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { traffic_load, motion_entropy_score, interaction_latency_variance, shake_accuracy } = body;

  if (
    !isValidNumber(traffic_load) ||
    !isValidNumber(motion_entropy_score) ||
    !isValidNumber(interaction_latency_variance)
  ) {
    return NextResponse.json(
      { error: "Invalid or missing numeric inputs" },
      { status: 400 }
    );
  }

  let score = 0;
  const reasons: string[] = [];

  if (traffic_load > 0.7) {
    score += 2;
    reasons.push("elevated traffic load");
  }

  if (motion_entropy_score < 0.3) {
    score += 2;
    reasons.push("low motion entropy");
  }

  if (interaction_latency_variance < 0.2) {
    score += 1;
    reasons.push("low interaction latency variance");
  }

  if (isValidNumber(shake_accuracy) && shake_accuracy < 0.5) {
    score += 2;
    reasons.push("poor shake accuracy");
  }

  let risk_level: RiskLevel;
  if (score <= 1) {
    risk_level = "low";
  } else if (score <= 3) {
    risk_level = "medium";
  } else {
    risk_level = "high";
  }

  const step_up_map: Record<RiskLevel, StepUp> = {
    low: "none",
    medium: "tilt",
    high: "beat",
  };

  const reason_map: Record<RiskLevel, string> = {
    low: "No significant risk signals detected.",
    medium: `Moderate risk detected: ${reasons.join(", ")}.`,
    high: `High risk detected: ${reasons.join(", ")}.`,
  };

  const result: EvaluateResponse = {
    risk_level,
    reason: reason_map[risk_level],
    step_up: step_up_map[risk_level],
  };

  return NextResponse.json(result, { status: 200 });
}
