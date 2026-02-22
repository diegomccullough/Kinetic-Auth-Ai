export async function generateInstruction(step: string, risk_level: string) {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  const prompt = `
Generate a short spoken instruction under 20 words.
Step: ${step}
Risk level: ${risk_level}
Clear and calm tone.
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${AIzaSyAaPe9xQMPmktaa8Y_wkiRKbGYYEbpgSNw}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  const data = await res.json();

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Please follow the on-screen instructions.";
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
