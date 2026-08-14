import { JobHandler } from "@/server/handler";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // `canceled` is false when the job had already reached a terminal state.
    return Response.json(await JobHandler.cancel(id));
  } catch (err) {
    console.error("Failed to cancel job:", err);
    return Response.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
