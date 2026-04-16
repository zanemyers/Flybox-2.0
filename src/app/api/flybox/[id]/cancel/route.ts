import { JobHandler } from "@/server/handlers";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await JobHandler.cancel(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Failed to cancel job:", err);
    return Response.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
