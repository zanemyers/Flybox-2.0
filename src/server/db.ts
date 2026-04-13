import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type Job, type JobMessage } from "../../generated/prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export { prisma, type Job, type JobMessage };