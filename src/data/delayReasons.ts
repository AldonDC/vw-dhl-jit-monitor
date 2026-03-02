export interface DelayReasonOption {
  id: string;
  label: string;
  minutes: number;
}

export const DELAY_REASON_OPTIONS: DelayReasonOption[] = [
  { id: 'traffic', label: 'Trafico intenso', minutes: 20 },
  { id: 'truck_breakdown', label: 'Averia del camion', minutes: 50 },
  { id: 'blockade', label: 'Manifestacion y bloqueo del camino', minutes: 40 },
  { id: 'loading_delay', label: 'Retraso al subir las cosas al camion', minutes: 30 },
  { id: 'road_repair', label: 'Reparacion de las calles en ruta', minutes: 15 },
];

