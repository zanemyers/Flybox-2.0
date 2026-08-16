-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "rawFile" BYTEA,
ADD COLUMN     "rivers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "summarized" BOOLEAN NOT NULL DEFAULT false;
