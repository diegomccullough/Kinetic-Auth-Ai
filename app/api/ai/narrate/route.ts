import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

type Step = "tilt" | "beat" | "none";
type RiskLevel = "low" | "medium" | "high";

type NarrateBody = {
  step: Step;
  risk_level: RiskLevel;
  accessibility?: {
    reduce_motion?: boolean;
    screen_reader?: boolean;
    voice_guidance?: boolean;
  };
};

const GEMINI_FALLBACK_JSON = {
  text: "Please tilt your phone left to continue.",
  audio: null,
};

function buildPrompt(body: NarrateBody): string {
  const { step, risk_level, accessibility } = body;
  const simplify = Boolean(
    accessibility?.reduce_motion || accessibility?.screen_reader || accessibility?.voice_guidance
  );

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
${simplify ? "Use very simple language. No technical terms." : ""}
Rules: Plain text only. Under 20 words. No JSON, no markdown. Output only the instruction, nothing else.`;
}

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: NarrateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const step = body?.step ?? "none";
  const risk_level = body?.risk_level ?? "low";
  const accessibility = body?.accessibility ?? {};

  const apiKey = process.env.GEMINI_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !elevenKey) {
    return NextResponse.json(
      { error: "Missing API keys" },
      { status: 500 }
    );
  }

  if (!voiceId) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_VOICE_ID" },
      { status: 500 }
    );
  }

  let text: string;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 50,
      },
    });
    const prompt = buildPrompt({ step, risk_level, accessibility });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const generated = response.text()?.trim();
    if (typeof generated === "string" && generated.length > 0) {
      text = generated;
    } else {
      return NextResponse.json(GEMINI_FALLBACK_JSON, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return NextResponse.json(GEMINI_FALLBACK_JSON, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = `${ELEVENLABS_BASE}/${voiceId}?output_format=mp3_44100_128`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!res.ok || !res.body) {
      return NextResponse.json(
        { text, audio: null },
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { text, audio: null },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
