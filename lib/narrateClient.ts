export type NarratePayload = {
  step: "tilt" | "beat" | "none";
  risk_level: "low" | "medium" | "high";
  accessibility?: { voice_guidance?: boolean };
};

export type NarrateResult =
  | { kind: "audio"; blob: Blob }
  | { kind: "text"; text: string };

export async function narrate(payload: NarratePayload): Promise<NarrateResult> {
  const res = await fetch("/api/ai/narrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("audio")) {
    const blob = await res.blob();
    return { kind: "audio", blob };
  }
  const json = await res.json();
  const text = typeof (json as { text?: string }).text === "string" ? (json as { text: string }).text : "";
  return { kind: "text", text };
}
