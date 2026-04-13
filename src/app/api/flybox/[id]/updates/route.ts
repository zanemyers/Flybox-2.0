import { prisma } from "@/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [job, messages] = await Promise.all([
      prisma.job.findUniqueOrThrow({
        where: { id },
        select: { status: true, primaryFile: true, secondaryFile: true },
      }),
      prisma.jobMessage.findMany({
        where: { jobId: id },
        orderBy: { createdAt: "asc" },
        select: { message: true },
      }),
    ]);

    const files: Array<{ name: string; buffer: string }> = [];
    if (job.primaryFile) {
      files.push({
        name: "report_summary.txt",
        buffer: Buffer.from(job.primaryFile).toString("base64"),
      });
    }
    if (job.secondaryFile) {
      files.push({
        name: "shop_details.xlsx",
        buffer: Buffer.from(job.secondaryFile).toString("base64"),
      });
    }

    return Response.json({
      message: messages.map((m) => m.message).join("\n"),
      status: job.status,
      files,
    });
  } catch (err) {
    console.error("Failed to get job updates:", err);
    return Response.json({ error: "Job not found" }, { status: 404 });
  }
}
