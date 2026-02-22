import { GoogleGenerativeAI } from "@google/generative-ai";

type Step = "tilt" | "beat" | "none";
type RiskLevel = "low" | "medium" | "high";

function buildPrompt(step: Step, risk_level: RiskLevel): string {
  const toneByRisk: Record<RiskLevel, string> = {
    high: "Firm and security-focused.",
    medium: "Clear and direct.",
    low: "Calm and reassuring.",
  };

  let task = "";
  if (step === "tilt") {
    task = "Tell the user to tilt their phone to continue verification.";
  } else if (step === "beat") {
    task = "Tell the user to match the rhythm or tap in time with the beat.";
  } else {
    task = "Give a very short neutral prompt to continue.";
  }

  return `Generate a single short spoken instruction for a verification flow. ${task}
Tone: ${toneByRisk[risk_level]}
Use very simple language. No technical terms.
Rules: Plain text only. Under 20 words. No JSON, no markdown. Output only the instruction, nothing else.`;
}

const FALLBACK_TEXT: Record<Step, string> = {
  tilt: "Please tilt your phone left to continue.",
  beat: "Shake your phone in time with the beat.",
  none: "Please continue with verification.",
};

export async function generateInstruction(
  step: Step,
  risk_level: RiskLevel
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return FALLBACK_TEXT[step];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 50,
      },
    });
    const result = await model.generateContent(buildPrompt(step, risk_level));
    const text = result.response.text()?.trim();
    if (typeof text === "string" && text.length > 0) return text;
    return FALLBACK_TEXT[step];
  } catch {
    return FALLBACK_TEXT[step];
  }
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
