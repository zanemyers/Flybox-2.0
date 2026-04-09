import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Job,
    type JobMessage,
    type JobStatus,
    type JobType,} from '../../generated/prisma/client'

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma, type Job, type JobMessage, type JobStatus, type JobType };
