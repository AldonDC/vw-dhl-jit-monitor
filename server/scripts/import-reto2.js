const fs = require("node:fs");
const path = require("node:path");
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUPPLIER_CODE = "6001008710";
const SUPPLIER_NAME = "AKSYS SA DE CV";
const ROUTE_CODE = "T28";
const VEHICLE_UNIT_TYPE = "5 TON";
const SERVICE_DATE = new Date(Date.UTC(2026, 1, 4, 0, 0, 0, 0)); // 2026-02-04

// Ciclos obtenidos de la hoja PDF 6001008710-ciclos.pdf (ruta T28).
const CYCLE_ROWS = [
  ["06:00", "06:40", "07:10", "07:50", "NAVE 25 T CHAP"],
  ["08:20", "09:00", "09:30", "10:10", "NAVE 25 T CHAP"],
  ["10:40", "11:20", "11:50", "12:30", "NAVE 25 T CHAP"],
  ["13:00", "13:40", "14:10", "14:50", "NAVE 25 T CHAP"],
  ["15:35", "16:15", "17:00", "17:40", "NAVE 84 CHAP"],
  ["18:10", "18:50", "19:20", "20:00", "NAVE 25 T CHAP"],
  ["20:30", "21:10", "21:40", "22:20", "NAVE 25 T CHAP"],
  ["22:50", "23:30", "00:00", "00:40", "NAVE 25 T CHAP"],
  ["01:10", "01:50", "02:20", "03:00", "NAVE 25 T CHAP"],
  ["03:30", "04:10", "04:40", "05:20", "NAVE 25 T CHAP"],
];

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeZoneName(value) {
  const text = normalizeText(value).toUpperCase();
  if (!text) return "";
  if (text.includes("NAVE 84")) return "NAVE 84";
  if (text.includes("NAVE 25")) return "NAVE 25 T CHAP";
  return normalizeText(value);
}

function normalizeCoverageStatus(value) {
  const text = normalizeText(value).toUpperCase();
  if (text.includes("CUBIER")) return "CUBIERTO";
  if (text.includes("CRIT")) return "CRITICO";
  if (text.includes("RIESG")) return "RIESGO";
  return null;
}

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function toDateOnlyUtc(value) {
  if (!(value instanceof Date)) return null;
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function parseHHMM(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) {
    throw new Error(`Hora inválida: "${text}"`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Hora fuera de rango: "${text}"`);
  }
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

function buildSequentialClock(baseDate) {
  let rolloverDays = 0;
  let lastMinuteOfDay = null;

  return (hhmm) => {
    const parsed = parseHHMM(hhmm);
    if (lastMinuteOfDay !== null && parsed.totalMinutes < lastMinuteOfDay) {
      rolloverDays += 1;
    }
    lastMinuteOfDay = parsed.totalMinutes;
    return new Date(
      Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate() + rolloverDays,
        parsed.hours,
        parsed.minutes,
        0,
        0
      )
    );
  };
}

function getTurno(date) {
  const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();
  if (minuteOfDay >= 6 * 60 && minuteOfDay < 15 * 60) return 1;
  if (minuteOfDay >= 15 * 60 && minuteOfDay < 23 * 60 + 30) return 2;
  return 3;
}

async function upsertLocation(name, type) {
  return prisma.location.upsert({
    where: { name_type: { name, type } },
    create: { name, type },
    update: {},
  });
}

async function importTrips(routeId, supplierLocationId, vwLocationId) {
  const sequenceClock = buildSequentialClock(SERVICE_DATE);

  for (let i = 0; i < CYCLE_ROWS.length; i += 1) {
    const [supplierArriveHHMM, supplierDepartHHMM, vwArriveHHMM, vwDepartHHMM, zoneRaw] = CYCLE_ROWS[i];
    const zoneName = normalizeZoneName(zoneRaw);
    const zone = await upsertLocation(zoneName, "LOGISTIC_ZONE");

    const supplierArriveAt = sequenceClock(supplierArriveHHMM);
    const supplierDepartAt = sequenceClock(supplierDepartHHMM);
    const vwArriveAt = sequenceClock(vwArriveHHMM);
    const vwDepartAt = sequenceClock(vwDepartHHMM);
    const turno = getTurno(supplierArriveAt);
    const cycleNumber = i + 1;
    const tripCode = `${ROUTE_CODE}-${String(i + 1).padStart(2, "0")}`;

    const trip = await prisma.trip.upsert({
      where: {
        routeId_tripCode_serviceDate: {
          routeId,
          tripCode,
          serviceDate: SERVICE_DATE,
        },
      },
      create: {
        routeId,
        tripCode,
        turno,
        planned: true,
        serviceDate: SERVICE_DATE,
        departAt: supplierArriveAt,
        arriveAt: vwDepartAt,
        logisticZoneId: zone.id,
      },
      update: {
        turno,
        planned: true,
        departAt: supplierArriveAt,
        arriveAt: vwDepartAt,
        logisticZoneId: zone.id,
      },
    });

    await prisma.tripStop.deleteMany({ where: { tripId: trip.id } });
    await prisma.tripStop.createMany({
      data: [
        {
          tripId: trip.id,
          locationId: supplierLocationId,
          order: 1,
          arriveAt: supplierArriveAt,
          departAt: supplierDepartAt,
        },
        {
          tripId: trip.id,
          locationId: vwLocationId,
          order: 2,
          arriveAt: vwArriveAt,
          departAt: vwDepartAt,
        },
      ],
    });

    await prisma.dailyRouteSimulation.upsert({
      where: {
        routeId_serviceDate_cycleNumber: {
          routeId,
          serviceDate: SERVICE_DATE,
          cycleNumber,
        },
      },
      create: {
        routeId,
        serviceDate: SERVICE_DATE,
        cycleNumber,
        turno,
        supplierArriveAt,
        supplierDepartAt,
        vwArriveAt,
        vwDepartAt,
        logisticZoneLabel: zoneName,
      },
      update: {
        turno,
        supplierArriveAt,
        supplierDepartAt,
        vwArriveAt,
        vwDepartAt,
        logisticZoneLabel: zoneName,
      },
    });
  }
}

async function importInventory(supplierId, xlsxPath) {
  const workbook = xlsx.readFile(xlsxPath, { cellDates: true, raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("El Excel no contiene hojas.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 4) {
    throw new Error("El Excel no tiene la estructura esperada.");
  }

  const headerRow = rows[1] || [];
  const dateColumns = [];
  for (let c = 0; c < headerRow.length; c += 1) {
    if (headerRow[c] instanceof Date) dateColumns.push(c);
  }
  if (dateColumns.length === 0) {
    throw new Error("No se detectaron columnas de fecha en el Excel.");
  }

  for (let r = 3; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;

    const np = normalizeText(row[0]);
    if (!np) continue;

    const description = normalizeText(row[6]) || null;
    const zoneName = normalizeZoneName(row[8]);
    const status = normalizeCoverageStatus(row[9]);
    const capacityStatus = normalizeText(row[5]) || null;
    const stockTotal = toInt(row[2]);
    const stockZone = toInt(row[3]);
    const stockSupplier = toInt(row[4]);

    if (!zoneName) continue;

    const zone = await upsertLocation(zoneName, "LOGISTIC_ZONE");
    const part = await prisma.part.upsert({
      where: { np_supplierId: { np, supplierId } },
      create: { np, description, supplierId },
      update: { description },
    });

    const partZone = await prisma.partZone.upsert({
      where: {
        partId_logisticZoneId: {
          partId: part.id,
          logisticZoneId: zone.id,
        },
      },
      create: {
        partId: part.id,
        logisticZoneId: zone.id,
        status,
        capacityStatus,
      },
      update: {
        status,
        capacityStatus,
      },
    });

    for (const dateColumn of dateColumns) {
      const snapshotDate = toDateOnlyUtc(headerRow[dateColumn]);
      if (!snapshotDate) continue;

      const usedThatDay = toInt(row[dateColumn]);
      const saldo = toInt(row[dateColumn + 1]);

      await prisma.inventorySnapshot.upsert({
        where: {
          partZoneId_date: {
            partZoneId: partZone.id,
            date: snapshotDate,
          },
        },
        create: {
          partZoneId: partZone.id,
          date: snapshotDate,
          stockTotal,
          stockZone,
          stockSupplier,
          usedThatDay,
          saldo,
          status,
        },
        update: {
          stockTotal,
          stockZone,
          stockSupplier,
          usedThatDay,
          saldo,
          status,
        },
      });
    }
  }
}

async function resetData() {
  await prisma.inventorySnapshot.deleteMany();
  await prisma.partZone.deleteMany();
  await prisma.dailyRouteSimulation.deleteMany();
  await prisma.tripStop.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.routeGeometry.deleteMany();
  await prisma.route.deleteMany();
  await prisma.part.deleteMany();
  await prisma.location.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.supplier.deleteMany();
}

async function printSummary() {
  const [suppliers, routes, vehicles, locations, trips, routeSimulations, tripStops, parts, partZones, snapshots] = await Promise.all([
    prisma.supplier.count(),
    prisma.route.count(),
    prisma.vehicle.count(),
    prisma.location.count(),
    prisma.trip.count(),
    prisma.dailyRouteSimulation.count(),
    prisma.tripStop.count(),
    prisma.part.count(),
    prisma.partZone.count(),
    prisma.inventorySnapshot.count(),
  ]);

  console.log("Importación completada:");
  console.log(`- Supplier: ${suppliers}`);
  console.log(`- Route: ${routes}`);
  console.log(`- Vehicle: ${vehicles}`);
  console.log(`- Location: ${locations}`);
  console.log(`- Trip: ${trips}`);
  console.log(`- DailyRouteSimulation: ${routeSimulations}`);
  console.log(`- TripStop: ${tripStops}`);
  console.log(`- Part: ${parts}`);
  console.log(`- PartZone: ${partZones}`);
  console.log(`- InventorySnapshot: ${snapshots}`);
}

async function main() {
  const useReset = process.argv.includes("--reset");
  const xlsxPath = path.resolve(__dirname, "../../Archivos_Reto2/BESI JIS AKSYS CW 09.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`No se encontró el archivo Excel en ${xlsxPath}`);
  }

  if (useReset) {
    console.log("Modo reset activo: limpiando datos del dominio JIT...");
    await resetData();
  }

  const supplier = await prisma.supplier.upsert({
    where: { code: SUPPLIER_CODE },
    create: { name: SUPPLIER_NAME, code: SUPPLIER_CODE },
    update: { name: SUPPLIER_NAME },
  });

  let vehicle = await prisma.vehicle.findFirst({
    where: { unitType: VEHICLE_UNIT_TYPE, plate: null },
  });
  if (!vehicle) {
    vehicle = await prisma.vehicle.create({
      data: { unitType: VEHICLE_UNIT_TYPE, plate: null },
    });
  }

  const route = await prisma.route.upsert({
    where: { code_supplierId: { code: ROUTE_CODE, supplierId: supplier.id } },
    create: {
      code: ROUTE_CODE,
      supplierId: supplier.id,
      vehicleId: vehicle.id,
    },
    update: {
      vehicleId: vehicle.id,
    },
  });

  const supplierLocation = await upsertLocation(SUPPLIER_NAME, "SUPPLIER");
  const vwLocation = await upsertLocation("VW PUEBLA", "VW");

  await importTrips(route.id, supplierLocation.id, vwLocation.id);
  await importInventory(supplier.id, xlsxPath);
  await printSummary();
}

main()
  .catch((error) => {
    console.error("Error durante la importación:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
