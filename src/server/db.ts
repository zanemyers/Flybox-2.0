import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  type Job,
  type JobMessage,
  PrismaClient,
} from "../../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export { type Job, type JobMessage, prisma };
