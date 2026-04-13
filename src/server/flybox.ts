import { StealthBrowser } from "@/server/browser";
import { JobStatus } from "@/server/constants";
import { runCrawlPhase } from "@/server/crawlPhase";
import { prisma } from "@/server/db";
import { ExcelFileHandler, TXTFileHandler } from "@/server/fileUtils";
import { runShopPhase } from "@/server/shopPhase";
import type { FlyboxPayload } from "@/server/types/flybox";

const log = (jobId: string, message: string) =>
  prisma.jobMessage.create({ data: { jobId, message } });

const isCanceled = async (jobId: string) => {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === JobStatus.CANCELED;
};

const setPrimaryFile = (jobId: string, data: Buffer) =>
  prisma.job.update({ where: { id: jobId }, data: { primaryFile: data } });

const setSecondaryFile = (jobId: string, data: Buffer) =>
  prisma.job.update({ where: { id: jobId }, data: { secondaryFile: data } });

const complete = (jobId: string) =>
  prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.COMPLETED },
  });

const fail = async (jobId: string, message?: string) => {
  if (message) await log(jobId, `❌ ${message}`);
  await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.FAILED },
  });
};

export async function runFlybox(
  jobId: string,
  payload: FlyboxPayload,
): Promise<void> {
  const browser = new StealthBrowser();

  try {
    await browser.launch();

    const allShops = await runShopPhase(
      payload,
      browser,
      (msg) => log(jobId, msg).then(),
      () => isCanceled(jobId),
    );

    if (await isCanceled(jobId)) return;

    const excel = new ExcelFileHandler();
    for (const shop of allShops) excel.addRow(shop);
    await setSecondaryFile(jobId, await excel.getBuffer());
    await log(jobId, `📊 Shop directory saved (${allShops.length} shops).`);

    let reportShops = allShops.filter((s) => s.fishingReport === true);

    if (payload.rivers.length > 0) {
      const riverTerms = payload.rivers.map((r) => r.toLowerCase().trim());
      reportShops = reportShops.filter((s) => {
        const combined = (
          s.name +
          " " +
          s.website +
          " " +
          s.address
        ).toLowerCase();
        return riverTerms.some((r) => combined.includes(r));
      });
      await log(
        jobId,
        `🏞️ Filtered to ${reportShops.length} shop(s) matching rivers: ${payload.rivers.join(", ")}`,
      );
    }

    if (reportShops.length === 0) {
      await log(
        jobId,
        "ℹ️ No shops with fishing reports found. Try a broader search.",
      );
      await complete(jobId);
      return;
    }

    if (await isCanceled(jobId)) return;

    const summary = await runCrawlPhase(
      reportShops,
      payload,
      browser,
      (msg) => log(jobId, msg).then(),
      () => isCanceled(jobId),
    );

    if (await isCanceled(jobId)) return;

    const txt = new TXTFileHandler();
    txt.append(summary);
    await setPrimaryFile(jobId, txt.getBuffer());
    await log(jobId, "📥 Report summary saved.");
    await complete(jobId);
  } catch (err) {
    await fail(jobId, String(err));
  } finally {
    await browser.close();
  }
}
