export interface RouteData {
  id: string;
  prov: string;
  origin: string;
  target: string;
  status: 'ok' | 'risk' | 'critical';
  window: string;
  real: string;
  delta: number;
  turno: number;
}

export interface Alert {
  id: string | number;
  type: 'crit' | 'warn' | 'info';
  title: string;
  desc: string;
  time: string;
  route: string;
}

export interface Vehicle {
  id: string;
  route: string;
  pos: [number, number];
  status: 'moving' | 'stopped' | 'alert';
  lastUpdate: string;
}

export interface KpiData {
  compliance: number;
  diesel_estimated: number;
  avg_delay: number;
  collections_total: number;
  collections_ok: number;
  collections_fail: number;
}

export type CoverageStatus = 'CUBIERTO' | 'RIESGO' | 'CRITICO' | null;

export interface SimulationDayValue {
  usedThatDay: number | null;
  saldo: number | null;
  demandPerHour?: number | null;
  stockZoneStart?: number | null;
  coverageHours?: number | null;
  firstDeliveryHour?: number | null;
  firstDeliveryCycle?: number | null;
  endStockZone?: number | null;
  endStockSupplier?: number | null;
}

export interface SimulationMatrixRow {
  id: string;
  np: string;
  disp: string | null;
  existencias: number | null;
  stockZonLog: number | null;
  stockProveedor: number | null;
  estatusCap: string | null;
  description: string | null;
  nombre: string;
  zonaLogistica: string;
  status: CoverageStatus;
  daily: Record<string, SimulationDayValue>;
}

export interface SimulationSummary {
  totalPartZones: number;
  negativeBalances: number;
  days: number;
  latestSnapshotDate: string | null;
}

export interface SimulationRouteRow {
  id: string;
  routeCode: string;
  supplierCode: string | null;
  supplierName: string;
  cycleNumber: number;
  turno: number;
  supplierArriveAt: string;
  supplierDepartAt: string;
  vwArriveAt: string;
  vwDepartAt: string;
  logisticZoneLabel: string;
}

export interface SimulationRouteSummary {
  totalCycles: number;
}

export interface RouteDelayAssignment {
  rowId: string;
  serviceDate: string | null;
  eventId: string | null;
  eventLabel: string | null;
  minutes: number;
  cycleNumber: number;
  routeCode: string;
  supplierName: string;
  logisticZoneLabel: string;
  appliedAt: string;
}

export interface SimulationProjectionRow {
  partZoneId: string;
  np: string;
  zoneName: string;
  daily: Record<string, SimulationDayValue>;
  finalStockZone: number;
  finalStockSupplier: number;
  remainingNeed: number;
}

export interface SimulationProjectedCycleLoad {
  serviceDate: string;
  cycleNumber: number;
  routeCode: string;
  logisticZoneLabel: string;
  supplierName: string;
  np: string | null;
  partZoneId: string | null;
  quantity: number;
  vwArriveAt: string | null;
}

export interface InventoryProjectionPlan {
  baseDate: string | null;
  projectedDays: string[];
  rows: SimulationProjectionRow[];
  cycleLoads: SimulationProjectedCycleLoad[];
  settings: {
    businessDays: number;
    truckCapacity: number;
    supplierDailyIncrease: number;
  };
  summary: {
    projectedNegativeBalances: number;
    assignedCycles: number;
    totalCycles: number;
  };
}

export type Theme = 'light' | 'dark';
