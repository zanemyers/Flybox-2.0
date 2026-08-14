import { JobHandler, type Payload } from "@/server/handler";
import { runFlybox } from "@/server/pipeline";

/** Narrows the untrusted request body to a Payload, or explains what is wrong. */
function parsePayload(body: unknown): { payload: Payload } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Expected a JSON object." };
  const b = body as Record<string, unknown>;

  const required = ["serpApiKey", "geminiApiKey", "searchTerm", "summaryPrompt"] as const;
  const text = (key: string) => (typeof b[key] === "string" ? (b[key] as string) : "");

  const missing = required.filter((key) => !text(key).trim());
  if (missing.length) return { error: `Missing or empty: ${missing.join(", ")}.` };

  const latitude = Number(b.latitude);
  const longitude = Number(b.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: "latitude must be a number between -90 and 90." };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: "longitude must be a number between -180 and 180." };

  if (!Array.isArray(b.rivers) || b.rivers.some((r) => typeof r !== "string")) return { error: "rivers must be an array of strings." };

  return {
    payload: {
      serpApiKey: text("serpApiKey"),
      geminiApiKey: text("geminiApiKey"),
      searchTerm: text("searchTerm"),
      latitude,
      longitude,
      rivers: (b.rivers as string[]).map((r) => r.trim()).filter(Boolean),
      summaryPrompt: text("summaryPrompt"),
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

  try {
    const job = await JobHandler.create(parsed.payload);
    runFlybox(job).catch(() => {});
    return Response.json({ jobId: job.id });
  } catch (err) {
    console.error("Flybox job creation failed:", err);
    return Response.json({ error: "Failed to start job" }, { status: 500 });
  }
}
