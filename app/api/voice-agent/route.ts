import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { TOOL_DEFINITIONS, buildSystemPrompt } from "@/lib/voice/tools";

// Thin proxy to the Claude Messages API. The browser owns the agentic loop and
// executes the tools (they need live ticket state, quotes, and navigation), so
// this route is stateless: it takes the running conversation, asks Claude for the
// next step, and returns the assistant turn (text + tool_use blocks) verbatim.

const MODEL = process.env.ANTHROPIC_VOICE_MODEL || "claude-opus-4-8";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to the environment to enable the voice agent." },
      { status: 503 },
    );
  }

  let messages: Anthropic.MessageParam[];
  try {
    ({ messages } = (await req.json()) as { messages: Anthropic.MessageParam[] });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: buildSystemPrompt(new Date()), cache_control: { type: "ephemeral" } },
      ],
      tools: TOOL_DEFINITIONS as Anthropic.Tool[],
      messages,
    });
    return NextResponse.json({ content: response.content, stop_reason: response.stop_reason });
  } catch (e) {
    const message =
      e instanceof Anthropic.APIError
        ? `Claude API error ${e.status ?? ""}: ${e.message}`.trim()
        : e instanceof Error
          ? e.message
          : "Unknown voice agent error.";
    console.error("[voice-agent]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
