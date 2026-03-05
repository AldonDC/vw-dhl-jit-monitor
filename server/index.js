require("dotenv/config");
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 4000);
const DEFAULT_BUSINESS_DAYS = 5;
const DEFAULT_TRUCK_CAPACITY = 40;
const DEFAULT_SUPPLIER_DAILY_INCREASE = 30;
const DEFAULT_DEMAND_PESSIMISM_FACTOR = 1.35;

app.use(cors());
app.use(express.json());

function toIsoUtcDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 0, 0, 0, 0));
}

function isWeekendUtc(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function toNonNegativeInt(value, fallback, maxValue = 100000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < 0) return fallback;
  if (normalized > maxValue) return maxValue;
  return normalized;
}

function normalizeZoneKey(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (text.includes("NAVE 84")) return "NAVE 84";
  if (text.includes("NAVE 25")) return "NAVE 25";
  return text.replace(/\s+/g, " ");
}

function buildNextBusinessDays(baseDate, count) {
  const days = [];
  let cursor = addUtcDays(baseDate, 1);
  while (days.length < count) {
    if (!isWeekendUtc(cursor)) {
      days.push(cursor);
    }
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

function getUtcHourDecimal(date) {
  return date.getUTCHours() + date.getUTCMinutes() / 60;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/simulation", async (req, res, next) => {
  try {
    const partZones = await prisma.partZone.findMany({
      include: {
        logisticZone: true,
        part: {
          include: {
            supplier: true,
          },
        },
        snapshots: {
          orderBy: { date: "asc" },
        },
      },
    });

    const daySet = new Set();
    let negativeBalances = 0;

    for (const partZone of partZones) {
      for (const snapshot of partZone.snapshots) {
        const day = toIsoUtcDate(snapshot.date);
        daySet.add(day);
        if (typeof snapshot.saldo === "number" && snapshot.saldo < 0) {
          negativeBalances += 1;
        }
      }
    }

    const days = Array.from(daySet).sort((a, b) => (a < b ? -1 : 1));

    const rows = partZones
      .map((partZone) => {
        const firstSnapshot = partZone.snapshots[0];
        const daily = {};
        for (const day of days) {
          daily[day] = { usedThatDay: null, saldo: null };
        }
        for (const snapshot of partZone.snapshots) {
          const day = toIsoUtcDate(snapshot.date);
          daily[day] = {
            usedThatDay: snapshot.usedThatDay,
            saldo: snapshot.saldo,
          };
        }

        return {
          id: partZone.id,
          np: partZone.part.np,
          disp: null,
          existencias: firstSnapshot?.stockTotal ?? null,
          stockZonLog: firstSnapshot?.stockZone ?? null,
          stockProveedor: firstSnapshot?.stockSupplier ?? null,
          estatusCap: partZone.capacityStatus ?? null,
          description: partZone.part.description ?? null,
          nombre: partZone.part.supplier.name,
          zonaLogistica: partZone.logisticZone.name,
          status: partZone.status,
          daily,
        };
      })
      .sort((a, b) => {
        if (a.np !== b.np) return a.np.localeCompare(b.np);
        return a.zonaLogistica.localeCompare(b.zonaLogistica);
      });

    res.json({
      days,
      rows,
      summary: {
        totalPartZones: rows.length,
        negativeBalances,
        days: days.length,
        latestSnapshotDate: days.length > 0 ? days[days.length - 1] : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/simulation/routes", async (req, res, next) => {
  try {
    const parseDateOnly = (value) => {
      if (!value || typeof value !== "string") return null;
      const trimmed = value.trim();
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
      if (!match) return null;
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    };

    const requestedDate = parseDateOnly(req.query.date);
    let serviceDate = requestedDate;

    if (!serviceDate) {
      const latest = await prisma.dailyRouteSimulation.findFirst({
        orderBy: { serviceDate: "desc" },
        select: { serviceDate: true },
      });
      serviceDate = latest?.serviceDate ?? null;
    }

    if (!serviceDate) {
      return res.json({
        serviceDate: null,
        rows: [],
        summary: { totalCycles: 0 },
      });
    }

    const rows = await prisma.dailyRouteSimulation.findMany({
      where: { serviceDate },
      orderBy: { cycleNumber: "asc" },
      include: {
        route: {
          include: {
            supplier: true,
          },
        },
      },
    });

    res.json({
      serviceDate: serviceDate.toISOString(),
      rows: rows.map((row) => ({
        id: row.id,
        routeCode: row.route.code,
        supplierCode: row.route.supplier.code,
        supplierName: row.route.supplier.name,
        cycleNumber: row.cycleNumber,
        turno: row.turno,
        supplierArriveAt: row.supplierArriveAt.toISOString(),
        supplierDepartAt: row.supplierDepartAt.toISOString(),
        vwArriveAt: row.vwArriveAt.toISOString(),
        vwDepartAt: row.vwDepartAt.toISOString(),
        logisticZoneLabel: row.logisticZoneLabel,
      })),
      summary: {
        totalCycles: rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/simulation/projection", async (req, res, next) => {
  try {
    const persist = Boolean(req.body?.persist);
    const businessDays = Math.max(
      1,
      toNonNegativeInt(req.body?.businessDays, DEFAULT_BUSINESS_DAYS, 30)
    );
    const truckCapacity = Math.max(
      1,
      toNonNegativeInt(req.body?.truckCapacity, DEFAULT_TRUCK_CAPACITY, 10000)
    );
    const supplierDailyIncrease = toNonNegativeInt(
      req.body?.supplierDailyIncrease,
      DEFAULT_SUPPLIER_DAILY_INCREASE,
      100000
    );

    const [partZones, latestRouteDateRow] = await Promise.all([
      prisma.partZone.findMany({
        include: {
          logisticZone: true,
          part: {
            include: {
              supplier: true,
            },
          },
          snapshots: {
            orderBy: { date: "asc" },
          },
        },
      }),
      prisma.dailyRouteSimulation.findFirst({
        orderBy: { serviceDate: "desc" },
        select: { serviceDate: true },
      }),
    ]);

    let latestSnapshotDate = null;
    for (const partZone of partZones) {
      const latestSnapshot = partZone.snapshots[partZone.snapshots.length - 1];
      if (!latestSnapshot) continue;
      const latestDate = new Date(toIsoUtcDate(latestSnapshot.date));
      if (!latestSnapshotDate || latestDate > latestSnapshotDate) {
        latestSnapshotDate = latestDate;
      }
    }

    if (!latestSnapshotDate) {
      return res.json({
        baseDate: null,
        projectedDays: [],
        rows: [],
        cycleLoads: [],
        settings: {
          businessDays,
          truckCapacity,
          supplierDailyIncrease,
        },
        summary: {
          projectedNegativeBalances: 0,
          assignedCycles: 0,
          totalCycles: 0,
        },
      });
    }

    const projectedDayDates = buildNextBusinessDays(latestSnapshotDate, businessDays);
    const projectedDays = projectedDayDates.map((date) => date.toISOString());

    let routeTemplateRows = [];
    if (latestRouteDateRow?.serviceDate) {
      routeTemplateRows = await prisma.dailyRouteSimulation.findMany({
        where: { serviceDate: latestRouteDateRow.serviceDate },
        orderBy: { cycleNumber: "asc" },
        include: {
          route: {
            include: {
              supplier: true,
            },
          },
        },
      });
    }

    const latestSnapshotIso = toIsoUtcDate(latestSnapshotDate);
    const partStates = partZones.map((partZone) => {
      const exactLatestSnapshot =
        partZone.snapshots.find((snapshot) => toIsoUtcDate(snapshot.date) === latestSnapshotIso) ??
        partZone.snapshots[partZone.snapshots.length - 1] ??
        null;

      const stockZone = Number.isFinite(exactLatestSnapshot?.stockZone)
        ? exactLatestSnapshot.stockZone
        : 0;
      const stockSupplier = Number.isFinite(exactLatestSnapshot?.stockSupplier)
        ? exactLatestSnapshot.stockSupplier
        : 0;
      const usedTemplate = Number.isFinite(exactLatestSnapshot?.usedThatDay)
        ? exactLatestSnapshot.usedThatDay
        : 0;
      const fallbackSaldo = stockZone + stockSupplier - usedTemplate;
      const latestSaldo = Number.isFinite(exactLatestSnapshot?.saldo)
        ? exactLatestSnapshot.saldo
        : fallbackSaldo;

      return {
        partZoneId: partZone.id,
        np: partZone.part.np,
        status: partZone.status ?? null,
        zoneName: partZone.logisticZone.name,
        zoneKey: normalizeZoneKey(partZone.logisticZone.name),
        stockZone,
        stockSupplier,
        usedTemplate,
        currentSaldo: latestSaldo,
        remainingNeed: Math.max(0, -latestSaldo),
        daily: {},
      };
    });

    const cycleLoads = [];

    const pickCandidate = (zoneKey) => {
      const byNeedDesc = (a, b) => {
        if (b.remainingNeed !== a.remainingNeed) return b.remainingNeed - a.remainingNeed;
        return a.np.localeCompare(b.np);
      };

      const exactZone = partStates
        .filter((state) => state.zoneKey === zoneKey && state.remainingNeed > 0 && state.stockSupplier > 0)
        .sort(byNeedDesc);
      if (exactZone.length > 0) return exactZone[0];

      const anyZone = partStates
        .filter((state) => state.remainingNeed > 0 && state.stockSupplier > 0)
        .sort(byNeedDesc);
      return anyZone[0] ?? null;
    };

    for (const serviceDate of projectedDayDates) {
      const serviceDateIso = serviceDate.toISOString();

      for (const state of partStates) {
        state.remainingNeed = Math.max(0, -state.currentSaldo);
      }

      for (const state of partStates) {
        state.stockSupplier += supplierDailyIncrease;
      }

      const dayMetaByPartZoneId = new Map(
        partStates.map((state) => [
          state.partZoneId,
          {
            stockZoneStart: state.stockZone,
            firstDeliveryHour: null,
            firstDeliveryCycle: null,
          },
        ])
      );

      for (const cycle of routeTemplateRows) {
        const cycleZoneKey = normalizeZoneKey(cycle.logisticZoneLabel);
        const candidate = pickCandidate(cycleZoneKey);

        let quantity = 0;
        let np = null;
        let partZoneId = null;

        if (candidate) {
          quantity = Math.min(
            truckCapacity,
            candidate.stockSupplier,
            Math.ceil(candidate.remainingNeed)
          );

          if (quantity > 0) {
            candidate.stockSupplier -= quantity;
            candidate.stockZone += quantity;
            candidate.remainingNeed = Math.max(0, candidate.remainingNeed - quantity);
            np = candidate.np;
            partZoneId = candidate.partZoneId;

            const dayMeta = dayMetaByPartZoneId.get(candidate.partZoneId);
            if (dayMeta && dayMeta.firstDeliveryHour === null) {
              dayMeta.firstDeliveryHour = getUtcHourDecimal(cycle.vwArriveAt);
              dayMeta.firstDeliveryCycle = cycle.cycleNumber;
            }
          }
        }

        cycleLoads.push({
          serviceDate: serviceDateIso,
          cycleNumber: cycle.cycleNumber,
          routeCode: cycle.route.code,
          logisticZoneLabel: cycle.logisticZoneLabel,
          supplierName: cycle.route.supplier.name,
          np,
          partZoneId,
          quantity,
          vwArriveAt: cycle.vwArriveAt ? cycle.vwArriveAt.toISOString() : null,
        });
      }

      for (const state of partStates) {
        const usedThatDay = state.usedTemplate > 0
          ? Math.max(1, Math.ceil(state.usedTemplate * DEFAULT_DEMAND_PESSIMISM_FACTOR))
          : 0;
        const demandPerHour = usedThatDay > 0 ? usedThatDay / 23 : null;
        const carriedDeficit = Math.max(0, -state.currentSaldo);
        const dayMeta = dayMetaByPartZoneId.get(state.partZoneId);
        const stockZoneStart = dayMeta?.stockZoneStart ?? state.stockZone;
        const coverageHours = demandPerHour ? stockZoneStart / demandPerHour : null;
        const totalBeforeUse = state.stockZone + state.stockSupplier;
        const totalDemand = carriedDeficit + usedThatDay;
        const saldo = totalBeforeUse - totalDemand;

        let remainingUse = totalDemand;
        const fromZone = Math.min(state.stockZone, remainingUse);
        state.stockZone -= fromZone;
        remainingUse -= fromZone;

        const fromSupplier = Math.min(state.stockSupplier, remainingUse);
        state.stockSupplier -= fromSupplier;
        remainingUse -= fromSupplier;

        state.currentSaldo = saldo;
        state.remainingNeed = Math.max(0, -saldo);

        state.daily[serviceDateIso] = {
          usedThatDay,
          saldo,
          demandPerHour,
          stockZoneStart,
          coverageHours,
          firstDeliveryHour: dayMeta?.firstDeliveryHour ?? null,
          firstDeliveryCycle: dayMeta?.firstDeliveryCycle ?? null,
          endStockZone: state.stockZone,
          endStockSupplier: state.stockSupplier,
        };
      }
    }

    if (persist && projectedDayDates.length > 0) {
      const dataToPersist = [];
      for (const state of partStates) {
        for (const day of projectedDays) {
          const projected = state.daily[day];
          if (!projected) continue;

          dataToPersist.push({
            partZoneId: state.partZoneId,
            date: new Date(day),
            stockTotal: (projected.endStockZone ?? 0) + (projected.endStockSupplier ?? 0),
            stockZone: projected.endStockZone ?? 0,
            stockSupplier: projected.endStockSupplier ?? 0,
            usedThatDay: projected.usedThatDay,
            saldo: projected.saldo,
            status: state.status,
            projected: true,
          });
        }
      }

      for (const item of dataToPersist) {
        await prisma.inventorySnapshot.upsert({
          where: {
            partZoneId_date: {
              partZoneId: item.partZoneId,
              date: item.date,
            },
          },
          create: item,
          update: item,
        });
      }
    }

    let projectedNegativeBalances = 0;
    for (const state of partStates) {
      for (const day of projectedDays) {
        const value = state.daily[day];
        if (value && typeof value.saldo === "number" && value.saldo < 0) {
          projectedNegativeBalances += 1;
        }
      }
    }

    const assignedCycles = cycleLoads.filter((cycle) => cycle.quantity > 0 && cycle.np).length;

    res.json({
      baseDate: latestSnapshotDate.toISOString(),
      projectedDays,
      rows: partStates.map((state) => ({
        partZoneId: state.partZoneId,
        np: state.np,
        zoneName: state.zoneName,
        daily: state.daily,
        finalStockZone: state.stockZone,
        finalStockSupplier: state.stockSupplier,
        remainingNeed: state.remainingNeed,
      })),
      cycleLoads,
      settings: {
        businessDays,
        truckCapacity,
        supplierDailyIncrease,
      },
      summary: {
        projectedNegativeBalances,
        assignedCycles,
        totalCycles: cycleLoads.length,
      },
      persisted: persist,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/simulation/projection", async (_req, res, next) => {
  try {
    const result = await prisma.inventorySnapshot.deleteMany({
      where: {
        projected: true,
      },
    });
    res.json({
      deletedSnapshots: result.count,
    });
  } catch (error) {
    next(error);
  }
});

// --- Reportes, correo, WhatsApp (demo o real) ---
const reportes = require("./reportes");

app.post("/api/reportes/enviar", async (req, res, next) => {
  try {
    const { summary = {}, emails = [], phones = [], incluirResumenAI = true } = req.body;
    const resumenAI = incluirResumenAI ? reportes.generarResumenAI(summary) : null;
    const { texto, html } = reportes.construirContenidoReporte(summary, resumenAI);
    const asunto = `Reporte JIT - ${summary.latestDay ? new Date(summary.latestDay).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Hoy"}`;

    const mensajeWhatsApp = resumenAI || texto;
    let emailResult = { enviado: false, demo: true };
    let whatsappResult = { enviado: false, demo: true, mensajeWhatsApp: null };

    if (emails.length > 0) {
      emailResult = await reportes.enviarCorreo(emails, asunto, texto, html);
    }
    whatsappResult = await reportes.enviarWhatsApp(Array.isArray(phones) ? phones : [], mensajeWhatsApp);

    res.json({
      ok: true,
      email: emailResult,
      whatsapp: whatsappResult,
      resumenAI: resumenAI || null,
      contenidoTexto: texto,
    });
  } catch (error) {
    next(error);
  }
});

// --- Predicción de retraso (mock para ML/demo) ---
app.get("/api/prediccion/retraso", (req, res) => {
  const { ruta = "", fecha = "" } = req.query;
  const riesgo = ruta ? (ruta.length % 3 === 0 ? "alto" : ruta.length % 3 === 1 ? "medio" : "bajo") : "medio";
  const minutosEstimados = riesgo === "alto" ? 25 : riesgo === "medio" ? 12 : 5;
  res.json({
    ruta: ruta || null,
    fecha: fecha || null,
    riesgo,
    minutosEstimados,
    mensaje: riesgo === "alto" ? "Ruta con historial de retrasos; monitorear." : "Dentro de lo esperado.",
  });
});

// --- Recomendaciones prioridad (piezas a reabastecer; desde simulación o mock) ---
app.get("/api/recomendaciones/prioridad", async (req, res, next) => {
  try {
    const latest = await prisma.dailyRouteSimulation.findFirst({
      orderBy: { serviceDate: "desc" },
      select: { serviceDate: true },
    });
    const serviceDate = latest?.serviceDate ?? null;
    const partZones = await prisma.partZone.findMany({
      include: {
        part: true,
        logisticZone: true,
        snapshots: {
          where: serviceDate ? { date: serviceDate } : {},
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });
    const withSaldo = partZones
      .map((pz) => {
        const snap = pz.snapshots[0];
        const saldo = snap?.saldo ?? null;
        return {
          partZoneId: pz.id,
          np: pz.part?.np ?? "",
          zona: pz.logisticZone?.name ?? "",
          saldo,
          prioridad: saldo != null && saldo < 0 ? "alta" : saldo != null && saldo < 50 ? "media" : "baja",
        };
      })
      .filter((r) => r.prioridad !== "baja")
      .sort((a, b) => (a.prioridad === "alta" ? -1 : b.prioridad === "alta" ? 1 : 0))
      .slice(0, 10);
    res.json({
      serviceDate: serviceDate ? toIsoUtcDate(serviceDate) : null,
      items: withSaldo,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error("API error:", error);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
