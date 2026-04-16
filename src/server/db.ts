import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Job, type JobMessage, JobStatus, PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

export { type Job, type JobMessage, JobStatus };
