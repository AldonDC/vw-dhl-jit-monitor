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
  id: number;
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

export type Theme = 'light' | 'dark';
