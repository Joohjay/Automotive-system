-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "avgCost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "changeDue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "cost" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "branchId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("branchId","prefix","day")
);

-- AddForeignKey
ALTER TABLE "DocumentCounter" ADD CONSTRAINT "DocumentCounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the document counters from existing historical documents so that new
-- documents continue the existing per-branch per-day sequence (no duplicates).
INSERT INTO "DocumentCounter" ("branchId", "prefix", "day", "value", "updatedAt")
SELECT "branchId", 'RCP', to_char("saleDate", 'YYYYMMDD'),
       MAX(COALESCE(NULLIF(substring("receiptNumber" FROM '[0-9]+$'), '')::int, 0)),
       now()
FROM "Sale"
WHERE "receiptNumber" ~ '^RCP-[0-9]{8}-[0-9]+$'
GROUP BY "branchId", to_char("saleDate", 'YYYYMMDD');

INSERT INTO "DocumentCounter" ("branchId", "prefix", "day", "value", "updatedAt")
SELECT "branchId", 'RET', to_char("returnDate", 'YYYYMMDD'),
       MAX(COALESCE(NULLIF(substring("returnNumber" FROM '[0-9]+$'), '')::int, 0)),
       now()
FROM "Return"
WHERE "returnNumber" ~ '^RET-[0-9]{8}-[0-9]+$'
GROUP BY "branchId", to_char("returnDate", 'YYYYMMDD');

-- Opening inventory valuation basis: historical per-location acquisition costs
-- cannot be reconstructed from current data, so existing stock is valued at the
-- product's current catalogue purchase price. Going forward, weighted-average
-- costing maintains the basis from actual purchase receipts.
UPDATE "Inventory" inv
SET "avgCost" = p."purchasePrice"
FROM "Product" p
WHERE p."id" = inv."productId";
