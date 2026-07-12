-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'NOT_CONFIGURED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "scanMessage" TEXT,
ADD COLUMN     "scanProvider" TEXT,
ADD COLUMN     "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN     "scannedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PhotoProof" ADD COLUMN     "scanMessage" TEXT,
ADD COLUMN     "scanProvider" TEXT,
ADD COLUMN     "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN     "scannedAt" TIMESTAMP(3);
