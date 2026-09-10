import { isOutputName, JobHandler, OUTPUT_FILES } from "@/server/handler";
import { allowDownload } from "@/server/rateLimit";

/** Streams one of a job's outputs. Split out of the 2s poll so a blob is read on download, not on every update. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;

  if (!isOutputName(name)) return Response.json({ error: "Unknown output file" }, { status: 404 });

  // run publishes the job ids that address this route, and each hit reads a blob out of Postgres.
  const gate = allowDownload(request.headers);
  if (!gate.allowed) {
    return Response.json(
      { error: gate.reason },
      { status: 429, headers: gate.retryAfterSeconds ? { "Retry-After": String(gate.retryAfterSeconds) } : undefined },
    );
  }

  try {
    const bytes = await JobHandler.getFile(id, name);
    if (!bytes) return Response.json({ error: "File not ready" }, { status: 404 });

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": OUTPUT_FILES[name].contentType,
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to read job file:", err);
    return Response.json({ error: "Failed to read file" }, { status: 500 });
  }
}
