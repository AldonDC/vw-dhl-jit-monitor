-- CreateTable
CREATE TABLE "DailyRouteSimulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "serviceDate" DATETIME NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "turno" INTEGER NOT NULL,
    "supplierArriveAt" DATETIME NOT NULL,
    "supplierDepartAt" DATETIME NOT NULL,
    "vwArriveAt" DATETIME NOT NULL,
    "vwDepartAt" DATETIME NOT NULL,
    "logisticZoneLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyRouteSimulation_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyRouteSimulation_serviceDate_idx" ON "DailyRouteSimulation"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRouteSimulation_routeId_serviceDate_cycleNumber_key" ON "DailyRouteSimulation"("routeId", "serviceDate", "cycleNumber");
