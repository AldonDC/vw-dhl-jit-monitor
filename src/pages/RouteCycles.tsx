import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Route as RouteIcon, MapPin, Clock, Gauge, Play, Pause, RotateCcw, RefreshCw } from 'lucide-react';
import type {
    InventoryProjectionPlan,
    RouteDelayAssignment,
    SimulationProjectedCycleLoad,
    SimulationRouteRow
} from '../types';

interface MetricBoxProps {
    label: string;
    value: string;
    sub: string;
    color: 'blue' | 'yellow' | 'red';
    icon: React.ReactNode;
}

interface RouteSimulationResponse {
    serviceDate: string | null;
    rows: SimulationRouteRow[];
    summary: {
        totalCycles: number;
    };
}

interface TimelineStep {
    label: string;
    time: string;
    desc: string;
}

interface RouteCyclesProps {
    delayAssignments: Record<string, RouteDelayAssignment>;
    projectionPlan: InventoryProjectionPlan | null;
    onProjectionPlanChange: (next: InventoryProjectionPlan | null) => void;
    onOpenDriverPage: () => void;
    onRevealDelay: (delayKey: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const DEFAULT_SIMULATION_SECONDS = 300;
const TARGET_PROJECTION_BUSINESS_DAYS = 5;
const TRUCK_CAPACITY = 40;
const SUPPLIER_DAILY_INCREASE = 30;

const MetricBox: React.FC<MetricBoxProps> = ({ label, value, sub, color, icon }) => {
    const colors = {
        blue: 'text-blue-600 dark:text-blue-400',
        yellow: 'text-yellow-600 dark:text-yellow-400',
        red: 'text-red-500',
    };
    return (
        <div className="glass-card p-8 rounded-[2rem] group hover:translate-y-[-4px] hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] group-hover:text-current transition-colors">{label}</span>
                <div className={`scale-90 opacity-50 group-hover:opacity-100 transition-all duration-200 ${colors[color]}`}>{icon}</div>
            </div>
            <p className={`text-4xl font-black mt-2 tracking-tighter ${colors[color]}`}>{value}</p>
            <p className="text-[10px] text-[var(--text-secondary)] font-black mt-2 uppercase tracking-widest leading-none">{sub}</p>
        </div>
    );
};

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

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function addMinutes(isoString: string, minutes: number): string {
    return new Date(new Date(isoString).getTime() + minutes * 60_000).toISOString();
}

function buildDelayKey(serviceDate: string | null, rowId: string): string {
    return serviceDate ? `${serviceDate}|${rowId}` : rowId;
}

function mergeProjectionPlans(
    current: InventoryProjectionPlan | null,
    incoming: InventoryProjectionPlan
): InventoryProjectionPlan {
    if (!current) return incoming;

    const mergedDays = Array.from(new Set([...(current.projectedDays ?? []), ...(incoming.projectedDays ?? [])]))
        .sort((a, b) => (a < b ? -1 : 1));

    const rowMap = new Map(current.rows.map((row) => [row.partZoneId, row] as const));
    for (const row of incoming.rows) {
        const existing = rowMap.get(row.partZoneId);
        if (!existing) {
            rowMap.set(row.partZoneId, row);
            continue;
        }
        rowMap.set(row.partZoneId, {
            ...existing,
            ...row,
            daily: {
                ...existing.daily,
                ...row.daily,
            },
        });
    }

    const cycleLoadMap = new Map(
        current.cycleLoads.map((load) => [`${load.serviceDate}|${load.routeCode}|${load.cycleNumber}`, load] as const)
    );
    for (const load of incoming.cycleLoads) {
        cycleLoadMap.set(`${load.serviceDate}|${load.routeCode}|${load.cycleNumber}`, load);
    }

    const mergedRows = Array.from(rowMap.values());
    const mergedCycleLoads = Array.from(cycleLoadMap.values());

    let projectedNegativeBalances = 0;
    for (const row of mergedRows) {
        for (const day of mergedDays) {
            const dayValue = row.daily[day];
            if (dayValue && typeof dayValue.saldo === 'number' && dayValue.saldo < 0) {
                projectedNegativeBalances += 1;
            }
        }
    }

    return {
        ...incoming,
        baseDate: current.baseDate ?? incoming.baseDate,
        projectedDays: mergedDays,
        rows: mergedRows,
        cycleLoads: mergedCycleLoads,
        summary: {
            projectedNegativeBalances,
            assignedCycles: mergedCycleLoads.filter((load) => load.quantity > 0 && load.np).length,
            totalCycles: mergedCycleLoads.length,
        },
    };
}

export const RouteCycles: React.FC<RouteCyclesProps> = ({
    delayAssignments,
    projectionPlan,
    onProjectionPlanChange,
    onOpenDriverPage,
    onRevealDelay,
}) => {
    const [routeRows, setRouteRows] = useState<SimulationRouteRow[]>([]);
    const [serviceDate, setServiceDate] = useState<string | null>(null);
    const [selectedCycle, setSelectedCycle] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [projectionLoading, setProjectionLoading] = useState(false);
    const [projectionError, setProjectionError] = useState<string | null>(null);
    const [selectedProjectionDate, setSelectedProjectionDate] = useState<string | null>(null);
    const [previewPlan, setPreviewPlan] = useState<InventoryProjectionPlan | null>(null);
    const [showLatePopup, setShowLatePopup] = useState(false);

    const [simulationSeconds, setSimulationSeconds] = useState(DEFAULT_SIMULATION_SECONDS);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const frameRef = useRef<number | null>(null);
    const startedAtRef = useRef(0);
    const baseProgressRef = useRef(0);
    const selectedCycleRef = useRef<number | null>(null);
    const routeRowsRef = useRef<SimulationRouteRow[]>([]);
    const selectedProjectionDateRef = useRef<string | null>(null);
    const projectedDaysRef = useRef<string[]>([]);
    const projectionPlanRef = useRef<InventoryProjectionPlan | null>(projectionPlan);
    const playSequenceRef = useRef(false);
    const shownLatePopupRef = useRef<Set<string>>(new Set());

    const loadRouteSimulation = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/api/simulation/routes`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = (await response.json()) as RouteSimulationResponse;
            setRouteRows(data.rows);
            setServiceDate(data.serviceDate);
            setSelectedCycle((current) => current ?? data.rows[0]?.cycleNumber ?? null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`No se pudo cargar la simulacion: ${message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRouteSimulation();
    }, [loadRouteSimulation]);

    useEffect(() => {
        routeRowsRef.current = routeRows;
    }, [routeRows]);

    useEffect(() => {
        selectedCycleRef.current = selectedCycle;
    }, [selectedCycle]);

    useEffect(() => {
        projectionPlanRef.current = projectionPlan;
        projectedDaysRef.current = projectionPlan?.projectedDays ?? [];
    }, [projectionPlan]);

    useEffect(() => {
        selectedProjectionDateRef.current = selectedProjectionDate;
    }, [selectedProjectionDate]);

    useEffect(() => {
        if (!projectionPlan?.projectedDays?.length) {
            setSelectedProjectionDate(null);
            return;
        }
        setSelectedProjectionDate((current) => (
            current && projectionPlan.projectedDays.includes(current)
                ? current
                : projectionPlan.projectedDays[0]
        ));
    }, [projectionPlan]);

    useEffect(() => {
        if (projectionPlan) {
            setPreviewPlan(null);
        }
    }, [projectionPlan]);

    const selectedRoute = useMemo(() => {
        if (selectedCycle === null) return null;
        return routeRows.find((row) => row.cycleNumber === selectedCycle) ?? null;
    }, [routeRows, selectedCycle]);

    const activeServiceDate = selectedProjectionDate ?? serviceDate;

    const generateProjection = useCallback(async (businessDays: number, persist: boolean) => {
        setProjectionLoading(true);
        setProjectionError(null);
        try {
            const response = await fetch(`${API_BASE}/api/simulation/projection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    businessDays,
                    truckCapacity: TRUCK_CAPACITY,
                    supplierDailyIncrease: SUPPLIER_DAILY_INCREASE,
                    persist,
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = (await response.json()) as InventoryProjectionPlan;
            if (!persist) {
                return data;
            }
            const merged = mergeProjectionPlans(projectionPlanRef.current, data);
            projectionPlanRef.current = merged;
            onProjectionPlanChange(merged);
            return merged;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setProjectionError(`No se pudo generar la proyeccion de abastecimiento: ${message}`);
            return null;
        } finally {
            setProjectionLoading(false);
        }
    }, [onProjectionPlanChange]);

    const generatePreviewPlan = useCallback(async () => {
        setProjectionLoading(true);
        setProjectionError(null);
        try {
            const response = await fetch(`${API_BASE}/api/simulation/projection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    businessDays: 1,
                    truckCapacity: TRUCK_CAPACITY,
                    supplierDailyIncrease: SUPPLIER_DAILY_INCREASE,
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = (await response.json()) as InventoryProjectionPlan;
            setPreviewPlan(data);
            return data;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setProjectionError(`No se pudo generar la vista previa de carga: ${message}`);
            return null;
        } finally {
            setProjectionLoading(false);
        }
    }, []);

    const cycleLoadsByKey = useMemo(() => {
        const map = new Map<string, SimulationProjectedCycleLoad>();
        const sourceCycleLoads = projectionPlan?.cycleLoads ?? previewPlan?.cycleLoads ?? [];
        for (const load of sourceCycleLoads) {
            const key = `${load.serviceDate}|${load.routeCode}|${load.cycleNumber}`;
            map.set(key, load);
        }
        return map;
    }, [projectionPlan, previewPlan]);

    const effectiveLoadDate = useMemo(() => (
        selectedProjectionDate
        ?? projectionPlan?.projectedDays?.[0]
        ?? previewPlan?.projectedDays?.[0]
        ?? null
    ), [selectedProjectionDate, projectionPlan, previewPlan]);

    const selectedCycleLoad = useMemo(() => {
        if (!selectedRoute || !effectiveLoadDate) return null;
        const key = `${effectiveLoadDate}|${selectedRoute.routeCode}|${selectedRoute.cycleNumber}`;
        return cycleLoadsByKey.get(key) ?? null;
    }, [selectedRoute, effectiveLoadDate, cycleLoadsByKey]);

    const cycleTimingById = useMemo(() => {
        const sortedRows = [...routeRows].sort((a, b) => a.cycleNumber - b.cycleNumber);
        let carriedDelayMinutes = 0;
        const map = new Map<string, {
            eventDelayMinutes: number;
            carriedDelayMinutes: number;
            totalDelayMinutes: number;
            adjustedSupplierArriveAt: string;
            adjustedSupplierDepartAt: string;
            adjustedVwArriveAt: string;
            adjustedVwDepartAt: string;
        }>();

        for (const row of sortedRows) {
            const dayDelay = delayAssignments[buildDelayKey(activeServiceDate, row.id)];
            const fallbackDelay = delayAssignments[row.id];
            const eventDelayMinutes = (dayDelay ?? fallbackDelay)?.minutes ?? 0;
            const delayBeforeCycle = carriedDelayMinutes;
            const totalDelayMinutes = delayBeforeCycle + eventDelayMinutes;

            map.set(row.id, {
                eventDelayMinutes,
                carriedDelayMinutes: delayBeforeCycle,
                totalDelayMinutes,
                adjustedSupplierArriveAt: addMinutes(row.supplierArriveAt, delayBeforeCycle),
                adjustedSupplierDepartAt: addMinutes(row.supplierDepartAt, delayBeforeCycle),
                adjustedVwArriveAt: addMinutes(row.vwArriveAt, totalDelayMinutes),
                adjustedVwDepartAt: addMinutes(row.vwDepartAt, totalDelayMinutes),
            });

            carriedDelayMinutes += eventDelayMinutes;
        }

        return map;
    }, [routeRows, delayAssignments, activeServiceDate]);

    const selectedDelay = useMemo(() => {
        if (!selectedRoute) return null;
        return delayAssignments[buildDelayKey(activeServiceDate, selectedRoute.id)] ?? delayAssignments[selectedRoute.id] ?? null;
    }, [selectedRoute, delayAssignments, activeServiceDate]);

    const hasDriverReason = Boolean(selectedDelay?.eventLabel && selectedDelay.eventLabel.trim().length > 0);

    const selectedTiming = useMemo(() => {
        if (!selectedRoute) return null;
        return cycleTimingById.get(selectedRoute.id) ?? null;
    }, [selectedRoute, cycleTimingById]);

    const selectedDelayKey = useMemo(() => {
        if (!selectedRoute) return null;
        return buildDelayKey(activeServiceDate, selectedRoute.id);
    }, [selectedRoute, activeServiceDate]);

    const timelineSteps = useMemo<TimelineStep[]>(() => {
        if (!selectedRoute) return [];
        const carriedDelay = selectedTiming?.carriedDelayMinutes ?? 0;
        const totalDelay = selectedTiming?.totalDelayMinutes ?? 0;
        const cycleCargoLabel = selectedCycleLoad?.np
            ? `· Carga ${selectedCycleLoad.np} (${selectedCycleLoad.quantity} pzas)`
            : '';
        return [
            {
                label: 'Llegada proveedor',
                time: formatTime(selectedTiming?.adjustedSupplierArriveAt ?? selectedRoute.supplierArriveAt),
                desc: carriedDelay > 0 ? `Arrastre de ciclo previo (+${carriedDelay} min)` : 'Unidad en proveedor'
            },
            {
                label: 'Salida proveedor',
                time: formatTime(selectedTiming?.adjustedSupplierDepartAt ?? selectedRoute.supplierDepartAt),
                desc: carriedDelay > 0 ? `Salida desplazada (+${carriedDelay} min)` : 'Proveedor liberado'
            },
            {
                label: 'Llegada VW',
                time: formatTime(selectedTiming?.adjustedVwArriveAt ?? selectedRoute.vwArriveAt),
                desc: selectedDelay
                    ? hasDriverReason
                        ? `${selectedDelay.eventLabel} (+${selectedDelay.minutes} min), total +${totalDelay} min${cycleCargoLabel}`
                        : `Demora pendiente de validar (+${selectedDelay.minutes} min), total +${totalDelay} min${cycleCargoLabel}`
                    : totalDelay > 0
                        ? `Atraso acumulado (+${totalDelay} min)${cycleCargoLabel}`
                        : `Ingreso a planta${cycleCargoLabel}`
            },
            {
                label: 'Salida VW',
                time: formatTime(selectedTiming?.adjustedVwDepartAt ?? selectedRoute.vwDepartAt),
                desc: 'Ciclo completado'
            },
        ];
    }, [selectedRoute, selectedTiming, selectedDelay, selectedCycleLoad, hasDriverReason]);

    useEffect(() => {
        if (!isPlaying) {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            return;
        }

        const totalMs = simulationSeconds * 1000;
        startedAtRef.current = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startedAtRef.current;
            const next = Math.min(1, baseProgressRef.current + elapsed / totalMs);
            setProgress(next);
            if (next >= 1) {
                const currentCycle = selectedCycleRef.current;
                const rows = routeRowsRef.current;
                const currentIndex = rows.findIndex((row) => row.cycleNumber === currentCycle);
                const nextRow = currentIndex >= 0 ? rows[currentIndex + 1] : null;

                if (playSequenceRef.current && nextRow) {
                    setSelectedCycle(nextRow.cycleNumber);
                    selectedCycleRef.current = nextRow.cycleNumber;
                    setProgress(0);
                    baseProgressRef.current = 0;
                    startedAtRef.current = now;
                    frameRef.current = requestAnimationFrame(animate);
                    return;
                }

                const currentProjectedDate = selectedProjectionDateRef.current;
                const projectedDays = projectedDaysRef.current;
                if (playSequenceRef.current && !nextRow) {
                    const firstCycle = rows[0];
                    if (!firstCycle) {
                        playSequenceRef.current = false;
                        setIsPlaying(false);
                        frameRef.current = null;
                        return;
                    }

                    if (!currentProjectedDate && projectedDays.length === 0) {
                        setIsPlaying(false);
                        frameRef.current = null;
                        void (async () => {
                            const firstDayPlan = await generateProjection(1, true);
                            const firstProjectedDay = firstDayPlan?.projectedDays?.[0] ?? null;
                            if (!firstProjectedDay || !playSequenceRef.current) {
                                playSequenceRef.current = false;
                                return;
                            }
                            setSelectedProjectionDate(firstProjectedDay);
                            selectedProjectionDateRef.current = firstProjectedDay;
                            setSelectedCycle(firstCycle.cycleNumber);
                            selectedCycleRef.current = firstCycle.cycleNumber;
                            setProgress(0);
                            baseProgressRef.current = 0;
                            setIsPlaying(true);
                        })();
                        return;
                    }

                    if (currentProjectedDate && projectedDays.length > 0) {
                        const dayIndex = projectedDays.indexOf(currentProjectedDate);
                        const nextDay = dayIndex >= 0 ? projectedDays[dayIndex + 1] : null;
                        if (nextDay) {
                            setSelectedProjectionDate(nextDay);
                            selectedProjectionDateRef.current = nextDay;
                            setSelectedCycle(firstCycle.cycleNumber);
                            selectedCycleRef.current = firstCycle.cycleNumber;
                            setProgress(0);
                            baseProgressRef.current = 0;
                            startedAtRef.current = now;
                            frameRef.current = requestAnimationFrame(animate);
                            return;
                        }

                        if (projectedDays.length < TARGET_PROJECTION_BUSINESS_DAYS) {
                            setIsPlaying(false);
                            frameRef.current = null;
                            void (async () => {
                                const expandedPlan = await generateProjection(1, true);
                                if (!expandedPlan) {
                                    playSequenceRef.current = false;
                                    return;
                                }
                                const expandedDays = expandedPlan.projectedDays;
                                const appendedDay = expandedDays.find((day) => !projectedDays.includes(day))
                                    ?? expandedDays[expandedDays.length - 1]
                                    ?? null;
                                if (!appendedDay || !playSequenceRef.current) {
                                    playSequenceRef.current = false;
                                    return;
                                }
                                setSelectedProjectionDate(appendedDay);
                                selectedProjectionDateRef.current = appendedDay;
                                setSelectedCycle(firstCycle.cycleNumber);
                                selectedCycleRef.current = firstCycle.cycleNumber;
                                setProgress(0);
                                baseProgressRef.current = 0;
                                setIsPlaying(true);
                            })();
                            return;
                        }
                    }
                }

                playSequenceRef.current = false;
                baseProgressRef.current = 1;
                setIsPlaying(false);
                frameRef.current = null;
                return;
            }
            frameRef.current = requestAnimationFrame(animate);
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [isPlaying, simulationSeconds, generateProjection]);

    const handlePlayPause = async () => {
        if (!timelineSteps.length || loading || !!error) return;
        if (isPlaying) {
            setIsPlaying(false);
            baseProgressRef.current = progress;
            playSequenceRef.current = false;
            return;
        }
        if (!projectionPlan && !previewPlan) {
            await generatePreviewPlan();
        }
        if (progress >= 1) {
            setProgress(0);
            baseProgressRef.current = 0;
        } else {
            baseProgressRef.current = progress;
        }
        playSequenceRef.current = true;
        setIsPlaying(true);
    };

    const handleReset = () => {
        setIsPlaying(false);
        setProgress(0);
        baseProgressRef.current = 0;
        playSequenceRef.current = false;
    };

    const handleCycleChange = (cycleNumber: number) => {
        setIsPlaying(false);
        setProgress(0);
        baseProgressRef.current = 0;
        playSequenceRef.current = false;
        setSelectedCycle(cycleNumber);
    };

    const activeStepIndex = useMemo(() => {
        if (timelineSteps.length <= 1) return 0;
        return Math.min(timelineSteps.length - 1, Math.floor(progress * (timelineSteps.length - 1) + 1e-9));
    }, [timelineSteps.length, progress]);

    useEffect(() => {
        if (!selectedDelayKey || !selectedDelay) return;
        if (selectedDelay.minutes <= 0) return;
        if (timelineSteps.length < 3) return;

        const vwArrivalProgress = 2 / (timelineSteps.length - 1);
        const reachedVwArrival = progress >= vwArrivalProgress;
        if (!reachedVwArrival) return;

        onRevealDelay(selectedDelayKey);

        if (hasDriverReason) return;
        if (shownLatePopupRef.current.has(selectedDelayKey)) return;
        shownLatePopupRef.current.add(selectedDelayKey);
        if (isPlaying) {
            setIsPlaying(false);
            baseProgressRef.current = progress;
            playSequenceRef.current = false;
        }
        setShowLatePopup(true);
    }, [selectedDelayKey, selectedDelay, hasDriverReason, progress, timelineSteps.length, onRevealDelay, isPlaying]);

    const progressPct = Math.round(progress * 100);
    const simulationDurationLabel = formatDuration(simulationSeconds);
    const displayServiceDate = selectedProjectionDate ?? serviceDate;
    const cargoLabel = selectedCycleLoad?.np
        ? `${selectedCycleLoad.np} (${selectedCycleLoad.quantity} pzas)`
        : 'Sin carga asignada';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-10 pb-10"
        >
            <div className="glass-card p-10 rounded-[2.5rem] hud-border flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-20 -mt-20"></div>
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20 shadow-inner">
                        <RouteIcon size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-tight">
                            Ruta {selectedRoute?.routeCode ?? '---'} · {selectedRoute?.supplierName ?? 'Sin datos'}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-blue-600 font-black uppercase tracking-[0.3em]">Simulacion</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                                {displayServiceDate ? formatDate(displayServiceDate) : 'Sin fecha'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="bg-emerald-500/10 text-emerald-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/40"></div>
                        {selectedRoute ? `Ciclo ${selectedRoute.cycleNumber} · T${selectedRoute.turno}` : 'Sin ciclo'}
                        {(selectedTiming?.totalDelayMinutes ?? 0) > 0 ? `· +${selectedTiming?.totalDelayMinutes ?? 0} min acumulado` : ''}
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 border border-[var(--border-color)] text-[10px] font-black uppercase tracking-widest rounded-2xl px-4 py-3 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span>Dia</span>
                        <select
                            value={selectedProjectionDate ?? ''}
                            onChange={(e) => setSelectedProjectionDate(e.target.value || null)}
                            className="bg-transparent outline-none min-w-28"
                            disabled={projectionLoading || !(projectionPlan?.projectedDays?.length)}
                        >
                            {!projectionPlan?.projectedDays?.length && (
                                <option value="" className="text-black">
                                    Base
                                </option>
                            )}
                            {(projectionPlan?.projectedDays ?? []).map((day) => (
                                <option key={day} value={day} className="text-black">
                                    {formatDate(day)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 border border-[var(--border-color)] text-[10px] font-black uppercase tracking-widest rounded-2xl px-4 py-3 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span>Ciclo</span>
                        <select
                            value={selectedCycle ?? ''}
                            onChange={(e) => handleCycleChange(Number(e.target.value))}
                            className="bg-transparent outline-none min-w-16"
                            disabled={loading || !routeRows.length}
                        >
                            {routeRows.map((row) => (
                                <option key={row.id} value={row.cycleNumber} className="text-black">
                                    {row.cycleNumber}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-blue-600/10 border border-blue-600/20 text-blue-700 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-2xl px-4 py-3">
                        Carga: {cargoLabel}
                    </div>
                </div>
            </div>

            {(selectedTiming?.totalDelayMinutes ?? 0) > 0 && (
                <div className="glass-card rounded-[2rem] p-6 border border-yellow-500/20 bg-yellow-500/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-700 dark:text-yellow-500">
                        {selectedDelay
                            ? hasDriverReason
                                ? `Evento activo: ${selectedDelay.eventLabel} (+${selectedDelay.minutes} min) · Arrastre previo +${selectedTiming?.carriedDelayMinutes ?? 0} min · Total +${selectedTiming?.totalDelayMinutes ?? 0} min`
                                : `Demora sin motivo validado (+${selectedDelay.minutes} min) · Arrastre previo +${selectedTiming?.carriedDelayMinutes ?? 0} min · Total +${selectedTiming?.totalDelayMinutes ?? 0} min`
                            : `Arrastre activo de ciclos previos: +${selectedTiming?.totalDelayMinutes ?? 0} min`}
                    </p>
                </div>
            )}

            <div className="glass-card rounded-[2rem] p-6 border border-blue-500/20 bg-blue-500/[0.03]">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
                    {projectionPlan
                        ? `Proyeccion activa: ${projectionPlan.projectedDays.length}/${TARGET_PROJECTION_BUSINESS_DAYS} dias habiles generados, camion ${projectionPlan.settings.truckCapacity} pzas, +${projectionPlan.settings.supplierDailyIncrease} stock proveedor/dia. Ciclos con carga: ${projectionPlan.summary.assignedCycles}/${projectionPlan.summary.totalCycles}.`
                        : 'Sin proyeccion de abastecimiento. Al presionar Play se generara primero el 2 de marzo y al completar cada bloque de 10 ciclos se ira agregando el siguiente dia habil.'}
                </p>
            </div>

            {projectionError && (
                <div className="glass-card p-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.12em] text-red-600">
                    {projectionError}
                </div>
            )}

            {showLatePopup && selectedDelay && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6">
                    <div className="w-full max-w-2xl glass-card rounded-[2rem] border border-[var(--border-color)] p-8">
                        <h3 className="text-xl font-black uppercase tracking-tight text-[var(--text-primary)]">
                            Llego tarde el camion a VW
                        </h3>
                        <p className="mt-3 text-sm font-bold text-[var(--text-secondary)]">
                            Se detecto demora de +{selectedDelay.minutes} min en el ciclo {selectedDelay.cycleNumber}. Da click para ver el registro del conductor.
                        </p>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-yellow-700 dark:text-yellow-500">
                            Motivo actual: pendiente
                        </p>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowLatePopup(false)}
                                className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/5 border border-[var(--border-color)] focus-ring active:scale-95 transition-transform duration-200 hover:bg-black/10 dark:hover:bg-white/10"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    setShowLatePopup(false);
                                    onOpenDriverPage();
                                }}
                                className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-[#001e50] dark:bg-blue-600 text-white focus-ring active:scale-95 transition-transform duration-200 hover:opacity-90"
                            >
                                Ver registro del conductor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-card rounded-[2.5rem] p-8 hud-border space-y-6 transition-shadow duration-300 hover:shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Control de simulación</h3>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-2 font-bold">
                            Duración total del ciclo en pantalla (máximo 5:00 min).
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => { void handlePlayPause(); }}
                            disabled={!timelineSteps.length || loading || !!error || projectionLoading}
                            className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-[#001e50] dark:bg-blue-600 text-white flex items-center gap-2 disabled:opacity-50 focus-ring active:scale-95 transition-transform duration-200 hover:opacity-90"
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {projectionLoading ? 'Generando' : isPlaying ? 'Pausar' : 'Play'}
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/5 border border-[var(--border-color)] flex items-center gap-2 focus-ring active:scale-95 transition-transform duration-200 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                            <RotateCcw size={14} />
                            Reset
                        </button>
                        <button
                            onClick={() => { void generatePreviewPlan(); }}
                            disabled={projectionLoading}
                            className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 flex items-center gap-2 disabled:opacity-50 focus-ring active:scale-95 transition-transform duration-200 hover:bg-blue-600/20"
                        >
                            <RefreshCw size={14} />
                            Replan
                        </button>
                        <button
                            onClick={() => void loadRouteSimulation()}
                            className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/5 border border-[var(--border-color)] flex items-center gap-2 focus-ring active:scale-95 transition-transform duration-200 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                            <RefreshCw size={14} />
                            Reload
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>Duracion total simulacion</span>
                        <span className="text-blue-600">{simulationDurationLabel}</span>
                    </div>
                    <input
                        type="range"
                        min={30}
                        max={DEFAULT_SIMULATION_SECONDS}
                        step={10}
                        value={simulationSeconds}
                        onChange={(e) => setSimulationSeconds(Number(e.target.value))}
                        className="w-full accent-blue-600"
                    />
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        <span>0:30</span>
                        <span>2:30</span>
                        <span>5:00 (tiempo real)</span>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="glass-card p-8 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    Cargando rutas desde base de datos...
                </div>
            )}

            {error && (
                <div className="glass-card p-8 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.12em] text-red-600">
                    {error}
                </div>
            )}

            <div className="glass-card rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/[0.03] blur-[120px] -mr-32 -mt-32"></div>
                <div className="flex justify-between items-center mb-16 border-b border-[var(--border-color)] pb-6 relative z-10">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Operational Cycle Timeline</h3>
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                        {progressPct}% completado
                    </div>
                </div>

                <div className="relative h-40 flex items-center px-10 relative z-10">
                    <div className="absolute h-1.5 w-[calc(100%-80px)] bg-black/5 dark:bg-white/5 rounded-full left-10"></div>
                    <div
                        className="absolute h-1.5 w-[calc(100%-80px)] bg-gradient-to-r from-blue-700 to-cyan-500 rounded-full left-10 shadow-[0_0_20px_rgba(59,130,246,0.3)] origin-left"
                        style={{ transform: `scaleX(${progress})` }}
                    ></div>

                    <div className="absolute w-full px-10 flex justify-between left-0">
                        {timelineSteps.map((step, index) => {
                            const status = progress >= 1
                                ? 'ok'
                                : index < activeStepIndex
                                    ? 'ok'
                                    : index === activeStepIndex
                                        ? 'current'
                                        : 'future';
                            return (
                                <div key={step.label} className="flex flex-col items-center group/step cursor-default">
                                    <div className={`w-10 h-10 rounded-2xl border-4 border-[var(--bg-surface)] z-10 shadow-2xl transition-all duration-500 flex items-center justify-center ${status === 'ok' ? 'bg-emerald-500 text-white' :
                                        status === 'current' ? 'bg-blue-600 scale-125 ring-8 ring-blue-500/10 text-white' :
                                            'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                        }`}>
                                        {status === 'ok' ? <MapPin size={16} /> : index + 1}
                                    </div>
                                    <div className="text-center mt-6 transition-transform duration-300 group-hover/step:-translate-y-1">
                                        <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">{step.label}</p>
                                        <p className="text-[10px] font-mono font-black text-blue-600 mt-1">{step.time}</p>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 opacity-0 group-hover/step:opacity-100 transition-all duration-300">{step.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <MetricBox label="Simulation Time" value={simulationDurationLabel} sub="Slider Selected" color="yellow" icon={<Clock size={24} />} />
                <MetricBox label="Progress" value={`${progressPct}%`} sub={isPlaying ? 'Running' : progress >= 100 ? 'Completed' : 'Ready'} color="blue" icon={<Gauge size={24} />} />
                <MetricBox label="Destination" value={selectedRoute?.logisticZoneLabel ?? '---'} sub="Logistic Zone" color="blue" icon={<RouteIcon size={24} />} />
                <MetricBox
                    label="VW Exit"
                    value={selectedRoute ? formatTime(selectedTiming?.adjustedVwDepartAt ?? selectedRoute.vwDepartAt) : '--:--'}
                    sub={(selectedTiming?.totalDelayMinutes ?? 0) > 0 ? 'Cumulative Delay Applied' : 'Planned Time'}
                    color="blue"
                    icon={<MapPin size={24} />}
                />
            </div>
        </motion.div>
    );
};
