// Apart from handler.test.ts because these mock the database, and that file wants the real module.

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  jobMessage: { findMany: vi.fn(), create: vi.fn() },
  job: { updateMany: vi.fn() },
}));

vi.mock("@/server/db", async () => {
  // The real enum, so a renamed status fails here rather than passing against a stale copy.
  const { JobStatus } = await import("../../generated/prisma/client");
  return { prisma: db, JobStatus };
});

const { JobStatus } = await import("@/server/db");
const { JobHandler, STALE_MESSAGE, TRUNCATED_MESSAGE } = await import("@/server/handler");
const { STALE_AFTER_MS } = await import("@/server/retention");

const MAX_LOG_LINES = 500;

/** One row shaped like the raw readiness query's result. */
function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    status: JobStatus.IN_PROGRESS,
    createdAt: new Date("2026-08-22T12:00:00Z"),
    heartbeatAt: new Date(),
    shopDirectory: true,
    hasPrimary: false,
    hasSecondary: false,
    hasRaw: false,
    ...over,
  };
}

/** The query returns newest-first, so tests hand back reversed input. */
const messages = (...lines: string[]) =>
  lines
    .slice()
    .reverse()
    .map((message) => ({ message }));

beforeEach(() => {
  db.$queryRaw.mockReset().mockResolvedValue([row()]);
  db.jobMessage.findMany.mockReset().mockResolvedValue([]);
  db.jobMessage.create.mockReset().mockResolvedValue({});
  db.job.updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("getUpdates", () => {
  it("throws when the job is gone, so the route can answer 404", async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(JobHandler.getUpdates("missing")).rejects.toThrow(/not found/i);
  });

  it("returns the log oldest-first, undoing the query's newest-first order", async () => {
    db.jobMessage.findMany.mockResolvedValue(messages("[..] first", "[->] second", "[OK] third"));
    const { message } = await JobHandler.getUpdates("job1");
    expect(message).toBe("[..] first\n[->] second\n[OK] third");
  });

  it("asks for one more than the cap, so it can tell a full page from a complete one", async () => {
    await JobHandler.getUpdates("job1");
    expect(db.jobMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: MAX_LOG_LINES + 1 }));
  });

  it("says nothing about truncation when everything fits", async () => {
    db.jobMessage.findMany.mockResolvedValue(messages(...Array.from({ length: MAX_LOG_LINES }, (_, i) => `line ${i}`)));
    const { message } = await JobHandler.getUpdates("job1");
    expect(message).not.toContain(TRUNCATED_MESSAGE);
    expect(message.split("\n")).toHaveLength(MAX_LOG_LINES);
  });

  // A long raw-mode crawl writes a line per page, so this is reachable.
  it("keeps the newest lines and says so when there are more than the cap", async () => {
    const all = Array.from({ length: MAX_LOG_LINES + 40 }, (_, i) => `line ${i}`);
    db.jobMessage.findMany.mockResolvedValue(messages(...all));

    const lines = (await JobHandler.getUpdates("job1")).message.split("\n");

    expect(lines[0]).toBe(TRUNCATED_MESSAGE);
    expect(lines).toHaveLength(MAX_LOG_LINES + 1);
    // The tail is what survives: the very last line written is still there.
    expect(lines.at(-1)).toBe(`line ${MAX_LOG_LINES + 39}`);
    expect(lines).not.toContain("line 0");
  });

  it("promises the workbook only when the run asked for it", async () => {
    db.$queryRaw.mockResolvedValue([row({ shopDirectory: false })]);
    expect((await JobHandler.getUpdates("job1")).expected).toEqual(["report_summary.txt"]);

    db.$queryRaw.mockResolvedValue([row({ shopDirectory: true })]);
    expect((await JobHandler.getUpdates("job1")).expected).toEqual(["report_summary.txt", "shop_details.xlsx"]);
  });

  it("reports a file ready only once its bytes exist", async () => {
    db.$queryRaw.mockResolvedValue([row({ hasPrimary: true, hasSecondary: false })]);
    const { files } = await JobHandler.getUpdates("job1");
    expect(files).toEqual([{ name: "report_summary.txt" }]);
  });

  // rawFile is written on summarized runs but is not a deliverable.
  it("never offers the raw source text, even when it is ready", async () => {
    db.$queryRaw.mockResolvedValue([row({ hasRaw: true, hasPrimary: true })]);
    const { expected, files } = await JobHandler.getUpdates("job1");
    expect(expected).not.toContain("report_raw.txt");
    expect(files.map((f) => f.name)).not.toContain("report_raw.txt");
  });

  describe("a run whose process died", () => {
    const dead = () => [row({ heartbeatAt: new Date(Date.now() - STALE_AFTER_MS - 1_000) })];

    it("is reported FAILED with an explanation", async () => {
      db.$queryRaw.mockResolvedValue(dead());
      const { status, message } = await JobHandler.getUpdates("job1");
      expect(status).toBe(JobStatus.FAILED);
      expect(message).toContain(STALE_MESSAGE);
    });

    it("is retired in the database, but only while still IN_PROGRESS", async () => {
      db.$queryRaw.mockResolvedValue(dead());
      await JobHandler.getUpdates("job1");
      expect(db.job.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "job1", status: JobStatus.IN_PROGRESS }) }),
      );
    });

    // The poller that loses the conditional update must not also write the explanation.
    it("logs the explanation only for the poller that actually retired it", async () => {
      db.$queryRaw.mockResolvedValue(dead());
      db.job.updateMany.mockResolvedValue({ count: 0 });

      const { message } = await JobHandler.getUpdates("job1");

      expect(db.jobMessage.create).not.toHaveBeenCalled();
      // Still shown to this caller — it just is not written a second time.
      expect(message).toContain(STALE_MESSAGE);
    });

    it("leaves a finished run alone however old its heartbeat is", async () => {
      db.$queryRaw.mockResolvedValue([row({ status: JobStatus.COMPLETED, heartbeatAt: new Date(0) })]);
      const { status } = await JobHandler.getUpdates("job1");
      expect(status).toBe(JobStatus.COMPLETED);
      expect(db.job.updateMany).not.toHaveBeenCalled();
    });
  });
});
