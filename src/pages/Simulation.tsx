import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, RefreshCw, TriangleAlert } from 'lucide-react';
import { DELAY_REASON_OPTIONS } from '../data/delayReasons';
import type {
  InventoryProjectionPlan,
  RouteDelayAssignment,
  SimulationMatrixRow,
  SimulationRouteRow,
  SimulationRouteSummary,
  SimulationSummary
} from '../types';

interface SimulationResponse {
  days: string[];
  rows: SimulationMatrixRow[];
  summary: SimulationSummary;
}

interface SimulationRouteResponse {
  serviceDate: string | null;
  rows: SimulationRouteRow[];
  summary: SimulationRouteSummary;
}

interface SimulationProps {
  delayAssignments: Record<string, RouteDelayAssignment>;
  onDelayAssignmentsChange: (next: Record<string, RouteDelayAssignment>) => void;
  projectionPlan: InventoryProjectionPlan | null;
  onProjectionPlanChange: (next: InventoryProjectionPlan | null) => void;
}

type InventorySortDirection = 'asc' | 'desc';

interface InventorySortState {
  key: string;
  direction: InventorySortDirection;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TARGET_ROUTE_SIMULATION_DAYS = 5;
const DEFAULT_TRUCK_CAPACITY = 40;
const DEFAULT_SUPPLIER_DAILY_INCREASE = 30;
const DASHBOARD_YELLOW_TARGET_HOURS = 3;
const DASHBOARD_YELLOW_REBALANCE_RATIO = 0.35;

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

function addMinutes(isoString: string, minutes: number): string {
  return new Date(new Date(isoString).getTime() + minutes * 60_000).toISOString();
}

function buildDelayKey(serviceDate: string | null, rowId: string): string {
  return serviceDate ? `${serviceDate}|${rowId}` : rowId;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 0, 0, 0, 0));
}

function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function buildBusinessDaysFromBase(baseDateIso: string, count: number): string[] {
  const baseDate = new Date(baseDateIso);
  if (Number.isNaN(baseDate.getTime()) || count <= 0) return [];
  const result: string[] = [];
  let cursor = addUtcDays(baseDate, 1);
  while (result.length < count) {
    if (!isWeekendUtc(cursor)) {
      result.push(cursor.toISOString());
    }
    cursor = addUtcDays(cursor, 1);
  }
  return result;
}

function getStatusPill(status: SimulationMatrixRow['status']) {
  if (status === 'CRITICO') {
    return {
      label: 'CRITICO',
      className: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
  }
  if (status === 'RIESGO') {
    return {
      label: 'RIESGO',
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    };
  }
  return {
    label: status ?? 'CUBIERTO',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  };
}

function getInventorySortValue(row: SimulationMatrixRow, key: string): string | number | null {
  if (key.startsWith('used:')) {
    const day = key.slice('used:'.length);
    return row.daily[day]?.usedThatDay ?? null;
  }

  if (key.startsWith('saldo:')) {
    const day = key.slice('saldo:'.length);
    return row.daily[day]?.saldo ?? null;
  }

  switch (key) {
    case 'np':
      return row.np;
    case 'disp':
      return row.disp;
    case 'existencias':
      return row.existencias;
    case 'stockZonLog':
      return row.stockZonLog;
    case 'stockProveedor':
      return row.stockProveedor;
    case 'estatusCap':
      return row.estatusCap;
    case 'description':
      return row.description;
    case 'nombre':
      return row.nombre;
    case 'zonaLogistica':
      return row.zonaLogistica;
    case 'status': {
      const statusRank: Record<string, number> = {
        CRITICO: 0,
        RIESGO: 1,
        CUBIERTO: 2,
      };
      return statusRank[row.status ?? 'CUBIERTO'] ?? 99;
    }
    default:
      return null;
  }
}

function compareInventoryValues(
  aValue: string | number | null,
  bValue: string | number | null,
  direction: InventorySortDirection
): number {
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return 1;
  if (bValue === null) return -1;

  let base = 0;
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    base = aValue - bValue;
  } else {
    base = String(aValue).localeCompare(String(bValue), 'es', { sensitivity: 'base' });
  }

  return direction === 'asc' ? base : -base;
}

function rebalanceProjectionPlanSaldosForDashboard(plan: InventoryProjectionPlan): InventoryProjectionPlan {
  if (!plan.projectedDays.length || !plan.rows.length) return plan;

  const rows = plan.rows.map((row) => ({
    ...row,
    daily: { ...row.daily },
  }));

  for (const day of plan.projectedDays) {
    const candidates = rows
      .map((row, index) => {
        const value = row.daily[day];
        if (!value || typeof value.saldo !== 'number' || value.saldo > 0) return null;
        if (typeof value.usedThatDay !== 'number' || value.usedThatDay <= 0) return null;

        const demandPerHour = typeof value.demandPerHour === 'number' && value.demandPerHour > 0
          ? value.demandPerHour
          : value.usedThatDay / 23;
        if (!Number.isFinite(demandPerHour) || demandPerHour <= 0) return null;

        return {
          index,
          demandPerHour,
          supplierBuffer: typeof value.endStockSupplier === 'number' ? value.endStockSupplier : 0,
        };
      })
      .filter((item): item is { index: number; demandPerHour: number; supplierBuffer: number } => Boolean(item))
      .sort((a, b) => {
        if (b.supplierBuffer !== a.supplierBuffer) return b.supplierBuffer - a.supplierBuffer;
        return b.demandPerHour - a.demandPerHour;
      });

    if (!candidates.length) continue;

    const targetCount = Math.max(1, Math.floor(candidates.length * DASHBOARD_YELLOW_REBALANCE_RATIO));
    for (let i = 0; i < targetCount; i++) {
      const candidate = candidates[i];
      const row = rows[candidate.index];
      const current = row.daily[day];
      if (!current) continue;

      const targetSaldo = Math.max(1, Math.round(candidate.demandPerHour * DASHBOARD_YELLOW_TARGET_HOURS));
      row.daily[day] = {
        ...current,
        saldo: targetSaldo,
        coverageHours: DASHBOARD_YELLOW_TARGET_HOURS,
      };
    }
  }

  const projectedNegativeBalances = rows.reduce((acc, row) => {
    for (const day of plan.projectedDays) {
      const value = row.daily[day];
      if (value && typeof value.saldo === 'number' && value.saldo < 0) {
        acc += 1;
      }
    }
    return acc;
  }, 0);

  const lastDay = plan.projectedDays[plan.projectedDays.length - 1];
  const normalizedRows = rows.map((row) => {
    const lastDaySaldo = row.daily[lastDay]?.saldo;
    return {
      ...row,
      remainingNeed: typeof lastDaySaldo === 'number' && lastDaySaldo < 0 ? Math.abs(lastDaySaldo) : 0,
    };
  });

  return {
    ...plan,
    rows: normalizedRows,
    summary: {
      ...plan.summary,
      projectedNegativeBalances,
    },
  };
}

export const Simulation: React.FC<SimulationProps> = ({
  delayAssignments,
  onDelayAssignmentsChange,
  projectionPlan,
  onProjectionPlanChange,
}) => {
  const [days, setDays] = useState<string[]>([]);
  const [rows, setRows] = useState<SimulationMatrixRow[]>([]);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [routeRows, setRouteRows] = useState<SimulationRouteRow[]>([]);
  const [routeSummary, setRouteSummary] = useState<SimulationRouteSummary | null>(null);
  const [routeServiceDate, setRouteServiceDate] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [delayProbability, setDelayProbability] = useState(20);
  const [deletingProjection, setDeletingProjection] = useState(false);
  const [skippingSimulation, setSkippingSimulation] = useState(false);
  const [inventorySort, setInventorySort] = useState<InventorySortState>({
    key: 'np',
    direction: 'asc',
  });

  const loadInventorySimulation = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const response = await fetch(`${API_BASE}/api/simulation?take=200`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as SimulationResponse;
      setDays(data.days);
      setRows(data.rows);
      setSummary(data.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setInventoryError(`No se pudo cargar inventario: ${message}`);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const loadRouteSimulation = useCallback(async () => {
    setRouteLoading(true);
    setRouteError(null);
    try {
      const response = await fetch(`${API_BASE}/api/simulation/routes`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as SimulationRouteResponse;
      setRouteRows(data.rows);
      setRouteSummary(data.summary);
      setRouteServiceDate(data.serviceDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRouteError(`No se pudo cargar rutas: ${message}`);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadInventorySimulation(), loadRouteSimulation()]);
  }, [loadInventorySimulation, loadRouteSimulation]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const routeSimulationDays = useMemo(() => {
    if (projectionPlan?.baseDate) {
      return buildBusinessDaysFromBase(projectionPlan.baseDate, TARGET_ROUTE_SIMULATION_DAYS);
    }
    if (projectionPlan?.projectedDays?.length) {
      return projectionPlan.projectedDays;
    }
    if (routeServiceDate) {
      return [routeServiceDate];
    }
    return [];
  }, [projectionPlan, routeServiceDate]);

  const routeDate = useMemo(() => {
    if (routeSimulationDays.length > 1) {
      return `${formatDate(routeSimulationDays[0])} - ${formatDate(routeSimulationDays[routeSimulationDays.length - 1])}`;
    }
    if (routeServiceDate) return formatDate(routeServiceDate);
    return '--';
  }, [routeServiceDate, routeSimulationDays]);

  const projectedRowsByPartZoneId = useMemo(
    () => new Map((projectionPlan?.rows ?? []).map((row) => [row.partZoneId, row] as const)),
    [projectionPlan]
  );

  const effectiveDays = useMemo(() => {
    const daySet = new Set(days);
    for (const day of projectionPlan?.projectedDays ?? []) {
      daySet.add(day);
    }
    return Array.from(daySet).sort((a, b) => (a < b ? -1 : 1));
  }, [days, projectionPlan]);

  const effectiveRows = useMemo(() => {
    return rows.map((row) => {
      const projected = projectedRowsByPartZoneId.get(row.id);
      if (!projected) return row;
      return {
        ...row,
        daily: {
          ...row.daily,
          ...projected.daily,
        },
      };
    });
  }, [rows, projectedRowsByPartZoneId]);

  const sortedInventoryRows = useMemo(() => {
    const rowsWithIndex = effectiveRows.map((row, index) => ({ row, index }));
    rowsWithIndex.sort((a, b) => {
      const aValue = getInventorySortValue(a.row, inventorySort.key);
      const bValue = getInventorySortValue(b.row, inventorySort.key);
      const compared = compareInventoryValues(aValue, bValue, inventorySort.direction);
      if (compared !== 0) return compared;
      return a.index - b.index;
    });
    return rowsWithIndex.map((entry) => entry.row);
  }, [effectiveRows, inventorySort]);

  const effectiveLatestDate = useMemo(() => {
    if (!effectiveDays.length) return '--';
    return formatDate(effectiveDays[effectiveDays.length - 1]);
  }, [effectiveDays]);

  const effectiveNegativeBalances = useMemo(() => {
    let negatives = 0;
    for (const row of effectiveRows) {
      for (const day of effectiveDays) {
        const dayValue = row.daily[day];
        if (dayValue && typeof dayValue.saldo === 'number' && dayValue.saldo < 0) {
          negatives += 1;
        }
      }
    }
    return negatives;
  }, [effectiveRows, effectiveDays]);

  const delayedRouteRows = useMemo(() => {
    const sortedRows = [...routeRows].sort((a, b) => a.cycleNumber - b.cycleNumber);
    const expandedRows: Array<SimulationRouteRow & {
      serviceDate: string;
      delay: RouteDelayAssignment | undefined;
      delayMinutes: number;
      carriedDelayMinutes: number;
      totalDelayMinutes: number;
      adjustedSupplierArriveAt: string;
      adjustedSupplierDepartAt: string;
      adjustedVwArriveAt: string;
      adjustedVwDepartAt: string;
      assignmentKey: string;
    }> = [];

    for (const serviceDate of routeSimulationDays) {
      let carriedDelayMinutes = 0;
      for (const row of sortedRows) {
        const assignmentKey = buildDelayKey(serviceDate, row.id);
        const delay = delayAssignments[assignmentKey] ?? delayAssignments[row.id];
        const eventDelayMinutes = delay?.minutes ?? 0;
        const delayBeforeCycle = carriedDelayMinutes;
        const totalDelayForVwTimes = delayBeforeCycle + eventDelayMinutes;

        expandedRows.push({
          ...row,
          serviceDate,
          assignmentKey,
          delay,
          delayMinutes: eventDelayMinutes,
          carriedDelayMinutes: delayBeforeCycle,
          totalDelayMinutes: totalDelayForVwTimes,
          adjustedSupplierArriveAt: addMinutes(row.supplierArriveAt, delayBeforeCycle),
          adjustedSupplierDepartAt: addMinutes(row.supplierDepartAt, delayBeforeCycle),
          adjustedVwArriveAt: addMinutes(row.vwArriveAt, totalDelayForVwTimes),
          adjustedVwDepartAt: addMinutes(row.vwDepartAt, totalDelayForVwTimes),
        });

        carriedDelayMinutes += eventDelayMinutes;
      }
    }

    return expandedRows;
  }, [routeRows, routeSimulationDays, delayAssignments]);

  const totalDelayMinutes = useMemo(
    () => delayedRouteRows.reduce((acc, row) => acc + row.delayMinutes, 0),
    [delayedRouteRows]
  );

  const delayedCycles = useMemo(
    () => delayedRouteRows.filter((row) => row.delayMinutes > 0).length,
    [delayedRouteRows]
  );

  const generateDelays = useCallback(() => {
    if (!routeSimulationDays.length) {
      onDelayAssignmentsChange({});
      return;
    }
    const nextDelays: Record<string, RouteDelayAssignment> = {};
    for (const serviceDate of routeSimulationDays) {
      for (const row of routeRows) {
        const shouldApply = Math.random() * 100 < delayProbability;
        if (!shouldApply) {
          continue;
        }
        const randomDelay = DELAY_REASON_OPTIONS[Math.floor(Math.random() * DELAY_REASON_OPTIONS.length)];
        const assignmentKey = buildDelayKey(serviceDate, row.id);
        nextDelays[assignmentKey] = {
          rowId: row.id,
          serviceDate,
          eventId: null,
          eventLabel: null,
          minutes: randomDelay.minutes,
          cycleNumber: row.cycleNumber,
          routeCode: row.routeCode,
          supplierName: row.supplierName,
          logisticZoneLabel: row.logisticZoneLabel,
          appliedAt: new Date().toISOString(),
        };
      }
    }
    onDelayAssignmentsChange(nextDelays);
  }, [routeRows, routeSimulationDays, delayProbability, onDelayAssignmentsChange]);

  const clearDelays = useCallback(() => {
    onDelayAssignmentsChange({});
  }, [onDelayAssignmentsChange]);

  const clearProjectedData = useCallback(async () => {
    setDeletingProjection(true);
    try {
      const response = await fetch(`${API_BASE}/api/simulation/projection`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      onProjectionPlanChange(null);
      onDelayAssignmentsChange({});
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setInventoryError(`No se pudo borrar proyecciones: ${message}`);
    } finally {
      setDeletingProjection(false);
    }
  }, [onProjectionPlanChange, onDelayAssignmentsChange, refreshAll]);

  const skipSimulation = useCallback(async () => {
    setSkippingSimulation(true);
    setInventoryError(null);
    try {
      const response = await fetch(`${API_BASE}/api/simulation/projection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessDays: TARGET_ROUTE_SIMULATION_DAYS,
          truckCapacity: projectionPlan?.settings.truckCapacity ?? DEFAULT_TRUCK_CAPACITY,
          supplierDailyIncrease: projectionPlan?.settings.supplierDailyIncrease ?? DEFAULT_SUPPLIER_DAILY_INCREASE,
          persist: true,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as InventoryProjectionPlan;
      const rebalancedPlan = rebalanceProjectionPlanSaldosForDashboard(data);
      onProjectionPlanChange(rebalancedPlan);
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setInventoryError(`No se pudo ejecutar SKIP Simulation: ${message}`);
    } finally {
      setSkippingSimulation(false);
    }
  }, [projectionPlan, onProjectionPlanChange, refreshAll]);

  const handleInventorySort = useCallback((key: string) => {
    setInventorySort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  }, []);

  const getSortIndicator = useCallback((key: string) => {
    if (inventorySort.key !== key) return '↕';
    return inventorySort.direction === 'asc' ? '▲' : '▼';
  }, [inventorySort]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      <div className="glass-card rounded-[2.5rem] p-8 border border-[var(--border-color)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 transition-shadow duration-300 hover:shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
            <Database size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">Datos de simulación</h2>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-2">
              Inventario y rutas importados desde Prisma.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">
            Materiales: {summary?.totalPartZones ?? rows.length}
          </span>
          <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            Saldos negativos: {effectiveNegativeBalances}
          </span>
          <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20">
            Días: {effectiveDays.length}
          </span>
          {projectionPlan && (
            <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Proyección: {projectionPlan.projectedDays.length} días hábiles
            </span>
          )}
          <button
            onClick={refreshAll}
            disabled={skippingSimulation}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-[var(--accent-color)] text-white flex items-center gap-2 focus-ring active:scale-95 transition-transform duration-200 hover:opacity-90"
          >
            <RefreshCw size={12} />
            Actualizar
          </button>
          <button
            onClick={() => { void skipSimulation(); }}
            disabled={skippingSimulation || deletingProjection}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 disabled:opacity-50 focus-ring active:scale-95 transition-transform duration-200 hover:bg-emerald-500/20"
          >
            {skippingSimulation ? 'Generando...' : 'SKIP Simulation'}
          </button>
          <button
            onClick={() => { void clearProjectedData(); }}
            disabled={deletingProjection || skippingSimulation}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 disabled:opacity-50 focus-ring active:scale-95 transition-transform duration-200"
          >
            {deletingProjection ? 'Borrando...' : 'Borrar proyección'}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-[var(--border-color)] transition-shadow duration-300 hover:shadow-lg">
        <div className="px-8 py-5 border-b border-[var(--border-color)] flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Tabla de inventario</h3>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">Último día: {effectiveLatestDate}</span>
        </div>
        <div className="px-8 py-3 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
          Las columnas con fecha representan lo que VW ocupa ese dia; la columna saldo representa la resta acumulada de existencias.
        </div>
        {projectionPlan && (
          <div className="px-8 py-3 border-b border-[var(--border-color)] text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-400 bg-blue-500/[0.04]">
            Proyeccion activa: dias habiles generados desde Route Cycles ({projectionPlan.projectedDays.map((day) => formatDate(day)).join(' · ')}), capacidad camion {projectionPlan.settings.truckCapacity} pzas, +{projectionPlan.settings.supplierDailyIncrease} stock proveedor por pieza al dia.
          </div>
        )}

        {inventoryLoading && (
          <div className="px-8 py-10 text-[12px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">
            Cargando datos...
          </div>
        )}

        {inventoryError && !inventoryLoading && (
          <div className="px-8 py-10 text-red-600 text-[12px] font-black uppercase tracking-[0.1em] flex items-center gap-2">
            <TriangleAlert size={16} />
            {inventoryError}
          </div>
        )}

        {!inventoryLoading && !inventoryError && (
          <div className="overflow-x-scroll pb-2">
            <table className="w-max min-w-full text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-surface)] shadow-[0_1px_0_0_var(--border-color)] text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('np')} className="inline-flex items-center gap-2 hover:text-blue-600">{`NP ${getSortIndicator('np')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('disp')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Disp ${getSortIndicator('disp')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('existencias')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Existencias ${getSortIndicator('existencias')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('stockZonLog')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Stock Zon log ${getSortIndicator('stockZonLog')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('stockProveedor')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Stock Proveedor ${getSortIndicator('stockProveedor')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('estatusCap')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Estatus cap ${getSortIndicator('estatusCap')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('description')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Descripcion ${getSortIndicator('description')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('nombre')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Nombre ${getSortIndicator('nombre')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('zonaLogistica')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Zona Logistica ${getSortIndicator('zonaLogistica')}`}</button></th>
                  <th className="px-6 py-4"><button onClick={() => handleInventorySort('status')} className="inline-flex items-center gap-2 hover:text-blue-600">{`Estatus ${getSortIndicator('status')}`}</button></th>
                  {effectiveDays.map((day) => (
                    <React.Fragment key={day}>
                      <th className="px-6 py-4 whitespace-nowrap">
                        <button onClick={() => handleInventorySort(`used:${day}`)} className="inline-flex items-center gap-2 hover:text-blue-600">
                          {`${formatDate(day)} ${getSortIndicator(`used:${day}`)}`}
                        </button>
                      </th>
                      <th className="px-6 py-4">
                        <button onClick={() => handleInventorySort(`saldo:${day}`)} className="inline-flex items-center gap-2 hover:text-blue-600">
                          {`Saldo ${getSortIndicator(`saldo:${day}`)}`}
                        </button>
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-bold">
                {sortedInventoryRows.map((row, i) => {
                  const status = getStatusPill(row.status);
                  return (
                    <tr key={row.id} className={`hover:bg-blue-500/[0.06] dark:hover:bg-blue-500/10 transition-colors duration-200 ${i % 2 === 1 ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''}`}>
                      <td className="px-6 py-4 text-[var(--text-primary)]">
                        <div className="flex flex-col">
                          <span className="font-black">{row.np}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.disp ?? 'FD'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.existencias ?? '--'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.stockZonLog ?? '--'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.stockProveedor ?? '--'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.estatusCap ?? '--'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)] min-w-[260px]">{row.description ?? '--'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.nombre}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{row.zonaLogistica}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      {effectiveDays.map((day) => {
                        const dayValue = row.daily[day] ?? { usedThatDay: null, saldo: null };
                        const saldoClass = dayValue.saldo !== null && dayValue.saldo < 0 ? 'text-red-600' : 'text-emerald-600';
                        return (
                          <React.Fragment key={`${row.id}-${day}`}>
                            <td className="px-6 py-4 text-blue-600">{dayValue.usedThatDay ?? '--'}</td>
                            <td className={`px-6 py-4 ${saldoClass}`}>{dayValue.saldo ?? '--'}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-[var(--border-color)]">
        <div className="px-8 py-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Simulación de rutas por día</h3>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Fecha servicio: {routeDate} · Ciclos: {delayedRouteRows.length || routeSummary?.totalCycles || '--'}
          </span>
        </div>
        <div className="px-8 py-5 border-b border-[var(--border-color)] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)] mb-2">
                <span>Probabilidad de demora por ciclo</span>
                <span className="text-blue-600">{delayProbability}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={delayProbability}
                onChange={(e) => setDelayProbability(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generateDelays}
                disabled={routeLoading || !routeRows.length}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-[var(--accent-color)] text-white disabled:opacity-50 focus-ring active:scale-95 transition-transform duration-200 hover:opacity-90"
              >
                Generar demoras
              </button>
              <button
                onClick={clearDelays}
                disabled={routeLoading || !routeRows.length}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] bg-black/5 dark:bg-white/5 border border-[var(--border-color)] disabled:opacity-50 focus-ring active:scale-95 transition-transform duration-200 hover:bg-black/10 dark:hover:bg-white/10"
              >
                Limpiar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.08em]">
            <span className="px-3 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">Dias considerados: {routeSimulationDays.length || 0}</span>
            <span className="px-3 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">Ciclos con evento: {delayedCycles}/{delayedRouteRows.length || 0}</span>
            <span className="px-3 py-1 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border border-yellow-500/20">Minutos de afectacion total: {totalDelayMinutes}</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Demoras posibles: {DELAY_REASON_OPTIONS.map((event) => `${event.label} (${event.minutes} min)`).join(' · ')}
          </div>
        </div>

        {routeLoading && (
          <div className="px-8 py-10 text-[12px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">
            Cargando rutas del PDF...
          </div>
        )}

        {routeError && !routeLoading && (
          <div className="px-8 py-10 text-red-600 text-[12px] font-black uppercase tracking-[0.1em] flex items-center gap-2">
            <TriangleAlert size={16} />
            {routeError}
          </div>
        )}

        {!routeLoading && !routeError && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-surface)] shadow-[0_1px_0_0_var(--border-color)] text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Ciclo</th>
                  <th className="px-6 py-4">Ruta</th>
                  <th className="px-6 py-4">Proveedor</th>
                  <th className="px-6 py-4">Turno</th>
                  <th className="px-6 py-4">Llegada Proveedor</th>
                  <th className="px-6 py-4">Llegada Proveedor Ajustada</th>
                  <th className="px-6 py-4">Salida Proveedor</th>
                  <th className="px-6 py-4">Salida Proveedor Ajustada</th>
                  <th className="px-6 py-4">Llegada VW</th>
                  <th className="px-6 py-4">Evento</th>
                  <th className="px-6 py-4">Demora Evento</th>
                  <th className="px-6 py-4">Atraso Acumulado</th>
                  <th className="px-6 py-4">Llegada VW Ajustada</th>
                  <th className="px-6 py-4">Salida VW</th>
                  <th className="px-6 py-4">Salida VW Ajustada</th>
                  <th className="px-6 py-4">Zona Logistica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-bold">
                {delayedRouteRows.map((row) => (
                  <tr key={row.assignmentKey} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{formatDate(row.serviceDate)}</td>
                    <td className="px-6 py-4 text-[var(--text-primary)]">{row.cycleNumber}</td>
                    <td className="px-6 py-4 text-blue-600">{row.routeCode}</td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">
                      <div className="flex flex-col">
                        <span>{row.supplierName}</span>
                        <span className="text-[10px]">{row.supplierCode ?? '--'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">T{row.turno}</td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{formatTime(row.supplierArriveAt)}</td>
                    <td className={`px-6 py-4 ${row.carriedDelayMinutes > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-[var(--text-secondary)]'}`}>
                      {formatTime(row.adjustedSupplierArriveAt)}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{formatTime(row.supplierDepartAt)}</td>
                    <td className={`px-6 py-4 ${row.carriedDelayMinutes > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-[var(--text-secondary)]'}`}>
                      {formatTime(row.adjustedSupplierDepartAt)}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{formatTime(row.vwArriveAt)}</td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] max-w-[280px]">
                      {row.delay?.eventLabel ?? ''}
                    </td>
                    <td className={`px-6 py-4 ${row.delayMinutes > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-[var(--text-secondary)]'}`}>
                      {row.delayMinutes > 0 ? `+${row.delayMinutes} min` : '--'}
                    </td>
                    <td className={`px-6 py-4 ${row.totalDelayMinutes > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-[var(--text-secondary)]'}`}>
                      {row.totalDelayMinutes > 0 ? `+${row.totalDelayMinutes} min` : '--'}
                    </td>
                    <td className={`px-6 py-4 ${row.totalDelayMinutes > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-[var(--text-secondary)]'}`}>
                      {formatTime(row.adjustedVwArriveAt)}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{formatTime(row.vwDepartAt)}</td>
                    <td className={`px-6 py-4 ${row.totalDelayMinutes > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-[var(--text-secondary)]'}`}>
                      {formatTime(row.adjustedVwDepartAt)}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">{row.logisticZoneLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
