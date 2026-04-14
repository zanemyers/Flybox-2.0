import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Job, type JobMessage, JobStatus, PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

export class JobContext {
  constructor(private readonly id: string) {}

  log(message: string) {
    return prisma.jobMessage.create({ data: { jobId: this.id, message } });
  }

  async isCanceled() {
    const job = await prisma.job.findUnique({ where: { id: this.id }, select: { status: true } });
    return job?.status === JobStatus.CANCELED;
  }

  setPrimaryFile(data: Buffer) {
    return prisma.job.update({ where: { id: this.id }, data: { primaryFile: new Uint8Array(data) } });
  }

  setSecondaryFile(data: Buffer) {
    return prisma.job.update({ where: { id: this.id }, data: { secondaryFile: new Uint8Array(data) } });
  }

  complete() {
    return prisma.job.update({ where: { id: this.id }, data: { status: JobStatus.COMPLETED } });
  }

  async fail(message?: string) {
    if (message) await this.log(`❌ ${message}`);
    await prisma.job.update({ where: { id: this.id }, data: { status: JobStatus.FAILED } });
  }
}

export { type Job, type JobMessage, JobStatus };
