-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('SUPPLIER', 'VW', 'LOGISTIC_ZONE', 'OTHER');

-- CreateEnum
CREATE TYPE "GeometrySource" AS ENUM ('GOOGLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('CUBIERTO', 'RIESGO', 'CRITICO');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "unitType" TEXT,
    "plate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "type" "LocationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "tripCode" TEXT NOT NULL,
    "turno" INTEGER NOT NULL,
    "planned" BOOLEAN NOT NULL DEFAULT true,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveAt" TIMESTAMP(3) NOT NULL,
    "logisticZoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "arriveAt" TIMESTAMP(3),
    "departAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRouteSimulation" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "turno" INTEGER NOT NULL,
    "supplierArriveAt" TIMESTAMP(3) NOT NULL,
    "supplierDepartAt" TIMESTAMP(3) NOT NULL,
    "vwArriveAt" TIMESTAMP(3) NOT NULL,
    "vwDepartAt" TIMESTAMP(3) NOT NULL,
    "logisticZoneLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRouteSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteGeometry" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "source" "GeometrySource" NOT NULL,
    "encodedPolyline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteGeometry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "np" TEXT NOT NULL,
    "description" TEXT,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartZone" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "logisticZoneId" TEXT NOT NULL,
    "status" "CoverageStatus",
    "capacityStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "partZoneId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "stockTotal" INTEGER,
    "stockZone" INTEGER,
    "stockSupplier" INTEGER,
    "usedThatDay" INTEGER,
    "saldo" INTEGER,
    "projected" BOOLEAN NOT NULL DEFAULT false,
    "status" "CoverageStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Route_code_supplierId_key" ON "Route"("code", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_type_key" ON "Location"("name", "type");

-- CreateIndex
CREATE INDEX "Trip_serviceDate_idx" ON "Trip"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_routeId_tripCode_serviceDate_key" ON "Trip"("routeId", "tripCode", "serviceDate");

-- CreateIndex
CREATE INDEX "TripStop_locationId_idx" ON "TripStop"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "TripStop_tripId_order_key" ON "TripStop"("tripId", "order");

-- CreateIndex
CREATE INDEX "DailyRouteSimulation_serviceDate_idx" ON "DailyRouteSimulation"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRouteSimulation_routeId_serviceDate_cycleNumber_key" ON "DailyRouteSimulation"("routeId", "serviceDate", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Part_np_supplierId_key" ON "Part"("np", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PartZone_partId_logisticZoneId_key" ON "PartZone"("partId", "logisticZoneId");

-- CreateIndex
CREATE INDEX "InventorySnapshot_date_idx" ON "InventorySnapshot"("date");

-- CreateIndex
CREATE INDEX "InventorySnapshot_projected_idx" ON "InventorySnapshot"("projected");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySnapshot_partZoneId_date_key" ON "InventorySnapshot"("partZoneId", "date");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_logisticZoneId_fkey" FOREIGN KEY ("logisticZoneId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRouteSimulation" ADD CONSTRAINT "DailyRouteSimulation_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteGeometry" ADD CONSTRAINT "RouteGeometry_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartZone" ADD CONSTRAINT "PartZone_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartZone" ADD CONSTRAINT "PartZone_logisticZoneId_fkey" FOREIGN KEY ("logisticZoneId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_partZoneId_fkey" FOREIGN KEY ("partZoneId") REFERENCES "PartZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

