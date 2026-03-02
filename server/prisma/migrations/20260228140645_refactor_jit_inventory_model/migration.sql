/*
  Warnings:

  - You are about to drop the column `partId` on the `InventorySnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `arriveHHMM` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `departHHMM` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `zoneText` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `arriveHHMM` on the `TripStop` table. All the data in the column will be lost.
  - You are about to drop the column `departHHMM` on the `TripStop` table. All the data in the column will be lost.
  - Added the required column `partZoneId` to the `InventorySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `InventorySnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Location` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Part` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Route` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RouteGeometry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `arriveAt` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departAt` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceDate` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TripStop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "PartZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "logisticZoneId" TEXT NOT NULL,
    "status" TEXT,
    "capacityStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartZone_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartZone_logisticZoneId_fkey" FOREIGN KEY ("logisticZoneId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventorySnapshot_partZoneId_fkey" FOREIGN KEY ("partZoneId") REFERENCES "PartZone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventorySnapshot" ("createdAt", "date", "id", "saldo", "stockSupplier", "stockTotal", "stockZone", "usedThatDay") SELECT "createdAt", "date", "id", "saldo", "stockSupplier", "stockTotal", "stockZone", "usedThatDay" FROM "InventorySnapshot";
DROP TABLE "InventorySnapshot";
ALTER TABLE "new_InventorySnapshot" RENAME TO "InventorySnapshot";
CREATE INDEX "InventorySnapshot_date_idx" ON "InventorySnapshot"("date");
CREATE UNIQUE INDEX "InventorySnapshot_partZoneId_date_key" ON "InventorySnapshot"("partZoneId", "date");
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Location" ("createdAt", "id", "lat", "lng", "name", "type") SELECT "createdAt", "id", "lat", "lng", "name", "type" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_name_type_key" ON "Location"("name", "type");
CREATE TABLE "new_Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "np" TEXT NOT NULL,
    "description" TEXT,
    "supplierId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Part" ("createdAt", "description", "id", "np", "supplierId") SELECT "createdAt", "description", "id", "np", "supplierId" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "new_Part" RENAME TO "Part";
CREATE UNIQUE INDEX "Part_np_supplierId_key" ON "Part"("np", "supplierId");
CREATE TABLE "new_Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Route_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Route" ("code", "createdAt", "id", "supplierId", "vehicleId") SELECT "code", "createdAt", "id", "supplierId", "vehicleId" FROM "Route";
DROP TABLE "Route";
ALTER TABLE "new_Route" RENAME TO "Route";
CREATE UNIQUE INDEX "Route_code_supplierId_key" ON "Route"("code", "supplierId");
CREATE TABLE "new_RouteGeometry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "encodedPolyline" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RouteGeometry_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RouteGeometry" ("createdAt", "encodedPolyline", "id", "routeId", "source") SELECT "createdAt", "encodedPolyline", "id", "routeId", "source" FROM "RouteGeometry";
DROP TABLE "RouteGeometry";
ALTER TABLE "new_RouteGeometry" RENAME TO "RouteGeometry";
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Supplier" ("code", "createdAt", "id", "name") SELECT "code", "createdAt", "id", "name" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE TABLE "new_Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "tripCode" TEXT NOT NULL,
    "turno" INTEGER NOT NULL,
    "planned" BOOLEAN NOT NULL DEFAULT true,
    "serviceDate" DATETIME NOT NULL,
    "departAt" DATETIME NOT NULL,
    "arriveAt" DATETIME NOT NULL,
    "logisticZoneId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_logisticZoneId_fkey" FOREIGN KEY ("logisticZoneId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Trip" ("createdAt", "id", "planned", "routeId", "tripCode", "turno") SELECT "createdAt", "id", "planned", "routeId", "tripCode", "turno" FROM "Trip";
DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";
CREATE INDEX "Trip_serviceDate_idx" ON "Trip"("serviceDate");
CREATE UNIQUE INDEX "Trip_routeId_tripCode_serviceDate_key" ON "Trip"("routeId", "tripCode", "serviceDate");
CREATE TABLE "new_TripStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "arriveAt" DATETIME,
    "departAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TripStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TripStop" ("id", "locationId", "order", "tripId") SELECT "id", "locationId", "order", "tripId" FROM "TripStop";
DROP TABLE "TripStop";
ALTER TABLE "new_TripStop" RENAME TO "TripStop";
CREATE INDEX "TripStop_locationId_idx" ON "TripStop"("locationId");
CREATE UNIQUE INDEX "TripStop_tripId_order_key" ON "TripStop"("tripId", "order");
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitType" TEXT,
    "plate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vehicle" ("createdAt", "id", "plate", "unitType") SELECT "createdAt", "id", "plate", "unitType" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PartZone_partId_logisticZoneId_key" ON "PartZone"("partId", "logisticZoneId");
