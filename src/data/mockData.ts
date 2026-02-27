import type { RouteData, Alert, Vehicle } from '../types';

export const ROUTES_DATA: RouteData[] = [
  { id: 'T28', prov: 'AKsys México', origin: 'FINSA', target: 'NAVE 25 T', status: 'ok', window: '07:10', real: '07:15', delta: 5, turno: 1 },
  { id: 'T15', prov: 'Faurecia', origin: 'Coronango', target: 'NAVE 84', status: 'risk', window: '09:30', real: '09:48', delta: 18, turno: 1 },
  { id: 'T32', prov: 'Brose', origin: 'Cuautlancingo', target: 'NAVE 21', status: 'critical', window: '14:10', real: '14:52', delta: 42, turno: 1 },
  { id: 'T09', prov: 'Benteler', origin: 'FINSA', target: 'NAVE 25 T', status: 'ok', window: '17:00', real: '17:05', delta: 5, turno: 2 },
  { id: 'T44', prov: 'ThyssenKrupp', origin: 'Amozoc', target: 'NAVE 21', status: 'ok', window: '19:20', real: '19:20', delta: 0, turno: 2 },
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
  DHL_GATE: [19.1210, -98.2390] as [number, number]
};

export const VEHICLES: Vehicle[] = [
  { id: 'T28-UNIT-01', route: 'T28', pos: [19.1120, -98.2250], status: 'moving', lastUpdate: '2m' },
  { id: 'T28-UNIT-02', route: 'T28', pos: [19.1245, -98.2440], status: 'stopped', lastUpdate: '14s' },
  { id: 'T30-UNIT-01', route: 'T30', pos: [19.1080, -98.2180], status: 'moving', lastUpdate: '5m' },
];

export const KPI_DATA = {
  compliance: 92.8,
  diesel_estimated: 1240,
  avg_delay: 14.5,
  collections_total: 48,
  collections_ok: 42,
  collections_fail: 6
};
