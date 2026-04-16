import { JobHandler } from "@/server/handlers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await JobHandler.getUpdates(id));
  } catch (err) {
    console.error("Failed to get job updates:", err);
    return Response.json({ error: "Job not found" }, { status: 404 });
  }
}
