import { hasKey } from "@/server/config";
import { JobHandler, type Payload } from "@/server/handler";
import { runFlybox } from "@/server/pipeline";
import { reserveRun } from "@/server/rateLimit";
import { MAX_RIVER_CHARS, MAX_RIVERS } from "@/shared/limits";

// Deliberately tiny: the search term and summary prompt are constants in config.ts, never fields.
function parsePayload(body: unknown): { payload: Payload } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Expected a JSON object." };
  const b = body as Record<string, unknown>;

  const latitude = Number(b.latitude);
  const longitude = Number(b.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: "latitude must be a number between -90 and 90." };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: "longitude must be a number between -180 and 180." };

  if (!Array.isArray(b.rivers) || b.rivers.some((r) => typeof r !== "string")) return { error: "rivers must be an array of strings." };
  if (b.rivers.length > MAX_RIVERS) return { error: `At most ${MAX_RIVERS} rivers.` };
  if (typeof b.summarize !== "boolean") return { error: "summarize must be true or false." };
  // Absent means true: a tab holding the bundle from before this option existed still submits a valid run.
  if (b.shopDirectory !== undefined && typeof b.shopDirectory !== "boolean") return { error: "shopDirectory must be true or false." };

  return {
    payload: {
      latitude,
      longitude,
      rivers: (b.rivers as string[]).map((r) => r.trim().slice(0, MAX_RIVER_CHARS)).filter(Boolean),
      summarize: b.summarize,
      shopDirectory: b.shopDirectory ?? true,
    },
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parsePayload(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  // Fail before spending anything if the server is misconfigured.
  if (!hasKey("SERP_API_KEY")) return Response.json({ error: "Flybox is not configured for search right now." }, { status: 503 });
  if (parsed.payload.summarize && !hasKey("OPENAI_API_KEY")) {
    return Response.json({ error: "Summarization is unavailable right now. Re-run with summarization turned off." }, { status: 503 });
  }

  // Admitted and recorded in one transaction (see rateLimit.ts), so a later failure costs the caller a run rather than granting a free one.
  const limit = await reserveRun(request.headers);
  if (!limit.allowed) {
    return Response.json(
      { error: limit.reason },
      { status: 429, headers: limit.retryAfterSeconds ? { "Retry-After": String(limit.retryAfterSeconds) } : undefined },
    );
  }

  try {
    const job = await JobHandler.create(parsed.payload);
    // runFlybox handles its own failures, so reaching here means fail() threw and the row may be stuck IN_PROGRESS.
    runFlybox(job).catch((err) => console.error(`Flybox job ${job.id} threw past its own error handling:`, err));
    return Response.json({ jobId: job.id });
  } catch (err) {
    console.error("Flybox job creation failed:", err);
    return Response.json({ error: "Failed to start job" }, { status: 500 });
  }
}
