export interface DelayReasonOption {
  id: string;
  label: string;
  minutes: number;
}

export const DELAY_REASON_OPTIONS: DelayReasonOption[] = [
  { id: 'traffic', label: 'Tráfico intenso', minutes: 20 },
  { id: 'truck_breakdown', label: 'Avería del camión', minutes: 50 },
  { id: 'blockade', label: 'Manifestación y bloqueo del camino', minutes: 40 },
  { id: 'loading_delay', label: 'Retraso al subir las cosas al camión', minutes: 30 },
  { id: 'road_repair', label: 'Reparación de las calles en ruta', minutes: 15 },
];

