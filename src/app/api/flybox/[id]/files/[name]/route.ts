import { isOutputName, JobHandler, OUTPUT_FILES } from "@/server/handler";

/** Streams one of a job's two fixed outputs. Split out of the 2s poll so the
    blobs are read once, on download, instead of on every update. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;

  if (!isOutputName(name)) return Response.json({ error: "Unknown output file" }, { status: 404 });

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
