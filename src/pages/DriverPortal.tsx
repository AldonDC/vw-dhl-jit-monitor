import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Clock3, CheckCircle2 } from 'lucide-react';
import { DELAY_REASON_OPTIONS } from '../data/delayReasons';
import type { InventoryProjectionPlan, RouteDelayAssignment, SimulationRouteRow } from '../types';

interface DriverPortalProps {
  delayAssignments: Record<string, RouteDelayAssignment>;
  onDelayAssignmentsChange: (next: Record<string, RouteDelayAssignment>) => void;
  projectionPlan: InventoryProjectionPlan | null;
  visibleDelayKeys: string[];
}

interface RouteSimulationResponse {
  serviceDate: string | null;
  rows: SimulationRouteRow[];
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function formatTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  delayAssignments,
  onDelayAssignmentsChange,
  projectionPlan,
  visibleDelayKeys,
}) => {
  const [routeRows, setRouteRows] = useState<SimulationRouteRow[]>([]);
  const [reasonByKey, setReasonByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/simulation/routes`);
        if (!response.ok) return;
        const data = (await response.json()) as RouteSimulationResponse;
        if (!canceled) {
          setRouteRows(data.rows);
        }
      } catch {
        if (!canceled) {
          setRouteRows([]);
        }
      }
    };
    void load();
    return () => {
      canceled = true;
    };
  }, []);

  const routeRowsById = useMemo(
    () => new Map(routeRows.map((row) => [row.id, row] as const)),
    [routeRows]
  );

  const cycleLoadsByKey = useMemo(() => {
    const map = new Map<string, { np: string | null; quantity: number }>();
    for (const load of projectionPlan?.cycleLoads ?? []) {
      const key = `${load.serviceDate}|${load.routeCode}|${load.cycleNumber}`;
      map.set(key, { np: load.np, quantity: load.quantity });
    }
    return map;
  }, [projectionPlan]);

  const allDelays = useMemo(() => (
    Object.entries(delayAssignments)
      .map(([key, delay]) => ({ key, delay }))
      .filter((item) => item.delay.minutes > 0)
      .sort((a, b) => (a.delay.appliedAt < b.delay.appliedAt ? 1 : -1))
  ), [delayAssignments]);

  const visibleDelaySet = useMemo(() => new Set(visibleDelayKeys), [visibleDelayKeys]);

  const visibleDelays = useMemo(
    () => allDelays.filter((item) => visibleDelaySet.has(item.key)),
    [allDelays, visibleDelaySet]
  );

  const pendingDelays = useMemo(
    () => visibleDelays.filter((item) => !(item.delay.eventLabel && item.delay.eventLabel.trim())),
    [visibleDelays]
  );

  const validateReason = (key: string) => {
    const selectedReasonId = reasonByKey[key];
    if (!selectedReasonId) return;
    const reason = DELAY_REASON_OPTIONS.find((option) => option.id === selectedReasonId);
    if (!reason) return;
    const current = delayAssignments[key];
    if (!current) return;

    const nextAssignments: Record<string, RouteDelayAssignment> = {
      ...delayAssignments,
      [key]: {
        ...current,
        eventId: reason.id,
        eventLabel: reason.label,
      },
    };
    onDelayAssignmentsChange(nextAssignments);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      <div className="glass-card rounded-[2.5rem] p-8 border border-[var(--border-color)] transition-shadow duration-300 hover:shadow-lg">
        <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">Registro conductor DHL</h2>
        <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-2">
          Demoras detectadas: {visibleDelays.length} · Pendientes de validar: {pendingDelays.length}
        </p>
      </div>

      {pendingDelays.length === 0 && (
        <div className="glass-card rounded-[2rem] p-8 border border-[var(--border-color)]">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            No hay demoras pendientes por validar.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {pendingDelays.map(({ key, delay }) => {
          const row = routeRowsById.get(delay.rowId);
          const serviceDate = delay.serviceDate;
          const loadKey = serviceDate ? `${serviceDate}|${delay.routeCode}|${delay.cycleNumber}` : null;
          const cargo = loadKey ? cycleLoadsByKey.get(loadKey) : null;
          const expectedArrival = row ? formatTime(row.vwArriveAt) : '--:--';

          return (
            <div key={key} className="glass-card rounded-[2rem] p-8 border border-[var(--border-color)] transition-shadow duration-300 hover:shadow-lg">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
                    Detectamos que has llegado tarde a VW
                  </p>
                  <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">
                    Ciclo {delay.cycleNumber} · Ruta {delay.routeCode}
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)] font-bold">
                    Tu ciclo de pedido fue {delay.cycleNumber}, la hora de llegada era {expectedArrival}.
                    {serviceDate ? ` Fecha: ${formatDate(serviceDate)}.` : ''}
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)] font-bold">
                    Transportabas: {cargo?.np ? `${cargo.np} (${cargo.quantity} pzas)` : 'pendiente'}.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                  <span className="px-3 py-2 rounded-xl bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border border-yellow-500/20 flex items-center gap-2">
                    <Clock3 size={12} /> +{delay.minutes} min
                  </span>
                  <span className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)] flex items-center gap-2">
                    <Truck size={12} /> Motivo: pendiente
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
                <select
                  value={reasonByKey[key] ?? ''}
                  onChange={(e) => setReasonByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="bg-black/5 dark:bg-white/5 border border-[var(--border-color)] rounded-2xl px-4 py-3 text-[12px] font-bold text-[var(--text-primary)] min-w-[320px]"
                >
                  <option value="">Selecciona motivo de demora</option>
                  {DELAY_REASON_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => validateReason(key)}
                  disabled={!reasonByKey[key]}
                  className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-[#001e50] dark:bg-blue-600 text-white disabled:opacity-50 flex items-center gap-2 focus-ring active:scale-95 transition-transform duration-200 hover:opacity-90"
                >
                  <CheckCircle2 size={14} />
                  Validar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
