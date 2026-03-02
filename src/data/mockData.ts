
import type { RouteData, Alert, Vehicle } from '../types';

export type Trip = {
  id: string;
  route: string;
  from: keyof typeof LOCATIONS;
  to: keyof typeof LOCATIONS;
  depart: string; // HH:MM
  arrive: string; // HH:MM
  zone: string;
  turno: 1 | 2 | 3;
};

export const ROUTES_DATA: RouteData[] = [
  { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 25 T', status: 'ok', window: '07:10', real: '07:15', delta: 5, turno: 1 },
];

export const ALERTS_DATA: Alert[] = [
  { id: 1, type: 'crit', title: 'Critical Delay T32', desc: 'Brose unit stopped due to mechanical failure on Periférico.', time: '14:52', route: 'T32' },
  { id: 2, type: 'warn', title: 'Window Variance T15', desc: 'Faurecia route nearing 20m delay limit.', time: '09:48', route: 'T15' },
];

export const LOCATIONS = {
  PLANTA_VW: [19.1260, -98.2462] as [number, number], // Coordenadas precisas VW Planta Puebla
  NAVE_21: [19.1245, -98.2440] as [number, number],
  PUERTO_3: [19.1275, -98.2485] as [number, number],
  AKSYS: [19.1065, -98.2160] as [number, number],
  FINSA: [19.1170, -98.2320] as [number, number],
};

// --- ROUTE GEOMETRIES (mock but consistent). Replace with real geometry later (Google/OSRM polyline decode).
export const ROUTE_PATHS: Record<string, [number, number][]> = {
  T28: [
    LOCATIONS.AKSYS,
    [19.1102, -98.2194],
    [19.1136, -98.2248],
    LOCATIONS.FINSA,
    [19.1199, -98.2362],
    LOCATIONS.NAVE_21,
    [19.1253, -98.2451],
    LOCATIONS.PLANTA_VW,
  ],
};

// --- TRIPS (from the PDF cycles). Times are planned; simulation can compress durations.
// T28 cycles (AKSYS -> VW). Zone varies (mostly Nave 25 T, one cycle to Nave 84).
export const TRIPS_T28: Trip[] = [
  { id: 'T28-01', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '06:00', arrive: '07:10', zone: 'NAVE 25 T', turno: 1 },
  { id: 'T28-02', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '08:20', arrive: '09:30', zone: 'NAVE 25 T', turno: 1 },
  { id: 'T28-03', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '10:40', arrive: '11:50', zone: 'NAVE 25 T', turno: 1 },
  { id: 'T28-04', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '13:00', arrive: '14:10', zone: 'NAVE 25 T', turno: 1 },
  { id: 'T28-05', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '15:35', arrive: '17:00', zone: 'NAVE 84', turno: 2 },
  { id: 'T28-06', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '18:10', arrive: '19:20', zone: 'NAVE 25 T', turno: 2 },
  { id: 'T28-07', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '20:30', arrive: '21:40', zone: 'NAVE 25 T', turno: 2 },
  { id: 'T28-08', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '22:50', arrive: '00:00', zone: 'NAVE 25 T', turno: 2 },
  { id: 'T28-09', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '01:10', arrive: '02:20', zone: 'NAVE 25 T', turno: 3 },
  { id: 'T28-10', route: 'T28', from: 'AKSYS', to: 'PLANTA_VW', depart: '03:30', arrive: '04:40', zone: 'NAVE 25 T', turno: 3 },
];

export const VEHICLES: Vehicle[] = [
  { id: 'T28-UNIT-01', route: 'T28', pos: LOCATIONS.AKSYS, status: 'moving', lastUpdate: 'now' },
];

export const KPI_DATA = {
  compliance: 92.8,
  diesel_estimated: 1240,
  avg_delay: 14.5,
  collections_total: 48,
  collections_ok: 42,
  collections_fail: 6
};
