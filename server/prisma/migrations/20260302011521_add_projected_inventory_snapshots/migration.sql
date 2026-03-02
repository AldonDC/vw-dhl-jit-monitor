-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventorySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partZoneId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "stockTotal" INTEGER,
    "stockZone" INTEGER,
    "stockSupplier" INTEGER,
    "usedThatDay" INTEGER,
    "saldo" INTEGER,
    "projected" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventorySnapshot_partZoneId_fkey" FOREIGN KEY ("partZoneId") REFERENCES "PartZone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventorySnapshot" ("createdAt", "date", "id", "partZoneId", "saldo", "status", "stockSupplier", "stockTotal", "stockZone", "updatedAt", "usedThatDay") SELECT "createdAt", "date", "id", "partZoneId", "saldo", "status", "stockSupplier", "stockTotal", "stockZone", "updatedAt", "usedThatDay" FROM "InventorySnapshot";
DROP TABLE "InventorySnapshot";
ALTER TABLE "new_InventorySnapshot" RENAME TO "InventorySnapshot";
CREATE INDEX "InventorySnapshot_date_idx" ON "InventorySnapshot"("date");
CREATE INDEX "InventorySnapshot_projected_idx" ON "InventorySnapshot"("projected");
CREATE UNIQUE INDEX "InventorySnapshot_partZoneId_date_key" ON "InventorySnapshot"("partZoneId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
