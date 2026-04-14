import { JobStatus, prisma } from "@/server/db";
import { runFlybox } from "@/server/flybox";
import type { FlyboxPayload } from "@/server/shopPhase";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const payload: FlyboxPayload = {
      serpApiKey: formData.get("serpApiKey") as string,
      geminiApiKey: formData.get("geminiApiKey") as string,
      searchTerm: formData.get("searchTerm") as string,
      latitude: Number(formData.get("latitude")),
      longitude: Number(formData.get("longitude")),
      rivers: JSON.parse((formData.get("rivers") as string) || "[]"),
      summaryPrompt: formData.get("summaryPrompt") as string,
    };

    const job = await prisma.job.create({
      data: { status: JobStatus.IN_PROGRESS },
    });

    runFlybox(job.id, payload).catch(() => {});

    return Response.json({ jobId: job.id });
  } catch (err) {
    console.error("Flybox job creation failed:", err);
    return Response.json({ error: "Failed to start job" }, { status: 500 });
  }
}
