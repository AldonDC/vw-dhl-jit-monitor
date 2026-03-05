import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock3, ShieldAlert, Activity, AlertTriangle, Gauge, Clock, Truck, Warehouse, Boxes, Route } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { LogisticsTable } from '../components/LogisticsTable';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend,
} from 'recharts';
import type {
    RouteData,
    InventoryProjectionPlan,
    RouteDelayAssignment,
    SimulationMatrixRow,
    SimulationRouteRow,
    SimulationSummary,
} from '../types';

interface DashboardProps {
    theme: 'light' | 'dark';
    projectionPlan: InventoryProjectionPlan | null;
    delayAssignments: Record<string, RouteDelayAssignment>;
}

interface SimulationResponse {
    days: string[];
    rows: SimulationMatrixRow[];
    summary: SimulationSummary;
}

interface SimulationRouteResponse {
    serviceDate: string | null;
    rows: SimulationRouteRow[];
    summary: {
        totalCycles: number;
    };
}

interface RiskItem {
    id: string;
    type: 'crit' | 'warn';
    title: string;
    desc: string;
    time: string;
    route: string;
    score: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const COVERAGE_TARGET = 95;

function formatDay(value: string): string {
    return new Date(value).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
    });
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function getCoverageHoursForDay(row: SimulationMatrixRow, day: string): number | null {
    const value = row.daily[day];
    if (!value) return null;

    if (typeof value.coverageHours === 'number' && Number.isFinite(value.coverageHours)) {
        return value.coverageHours;
    }

    if (typeof value.usedThatDay !== 'number' || value.usedThatDay <= 0) {
        return null;
    }

    const demandPerHour =
        typeof value.demandPerHour === 'number' && value.demandPerHour > 0
            ? value.demandPerHour
            : value.usedThatDay / 23;

    const stockBase =
        typeof value.stockZoneStart === 'number'
            ? value.stockZoneStart
            : typeof row.stockZonLog === 'number'
              ? row.stockZonLog
              : null;

    if (!Number.isFinite(demandPerHour) || demandPerHour <= 0) {
        return null;
    }

    if (stockBase === null || !Number.isFinite(stockBase)) {
        return null;
    }

    return stockBase / demandPerHour;
}

export const Dashboard: React.FC<DashboardProps> = ({ theme, projectionPlan, delayAssignments }) => {
    const isDark = theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#475569';

    const [days, setDays] = useState<string[]>([]);
    const [rows, setRows] = useState<SimulationMatrixRow[]>([]);
    const [summary, setSummary] = useState<SimulationSummary | null>(null);
    const [routeRows, setRouteRows] = useState<SimulationRouteRow[]>([]);
    const [routeServiceDate, setRouteServiceDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const loadDashboardData = useCallback(async () => {
        try {
            const [simulationRes, routesRes] = await Promise.all([
                fetch(`${API_BASE}/api/simulation?take=300`),
                fetch(`${API_BASE}/api/simulation/routes`),
            ]);

            if (!simulationRes.ok) {
                throw new Error(`Inventory HTTP ${simulationRes.status}`);
            }

            if (!routesRes.ok) {
                throw new Error(`Routes HTTP ${routesRes.status}`);
            }

            const simulationData = (await simulationRes.json()) as SimulationResponse;
            const routesData = (await routesRes.json()) as SimulationRouteResponse;

            setDays(simulationData.days);
            setRows(simulationData.rows);
            setSummary(simulationData.summary);
            setRouteRows(routesData.rows);
            setRouteServiceDate(routesData.serviceDate);
            setLastUpdated(new Date().toISOString());
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`No se pudieron cargar metricas del dashboard: ${message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboardData();
        const interval = window.setInterval(() => {
            void loadDashboardData();
        }, 8000);
        return () => window.clearInterval(interval);
    }, [loadDashboardData]);

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

    const latestDay = effectiveDays.length > 0 ? effectiveDays[effectiveDays.length - 1] : null;

    const metrics = useMemo(() => {
        const dailyTrend = effectiveDays.map((day) => {
            let used = 0;
            let shortage = 0;
            let covered = 0;
            let counted = 0;

            for (const row of effectiveRows) {
                const value = row.daily[day];
                if (!value) continue;

                if (typeof value.usedThatDay === 'number') {
                    used += value.usedThatDay;
                }

                if (typeof value.saldo === 'number') {
                    counted += 1;
                    if (value.saldo >= 0) {
                        covered += 1;
                    } else {
                        shortage += Math.abs(value.saldo);
                    }
                }
            }

            const coverage = counted > 0 ? (covered / counted) * 100 : 0;
            return {
                day,
                label: formatDay(day),
                used,
                shortage,
                coverage: Number(coverage.toFixed(1)),
            };
        });

        let coveredLatest = 0;
        let countedLatest = 0;
        let shortageLatest = 0;
        let usedLatest = 0;
        let totalCoverageHours = 0;
        let coverageHoursCount = 0;

        if (latestDay) {
            for (const row of effectiveRows) {
                const value = row.daily[latestDay];
                if (!value) continue;

                if (typeof value.usedThatDay === 'number') {
                    usedLatest += value.usedThatDay;
                }

                if (typeof value.saldo === 'number') {
                    countedLatest += 1;
                    if (value.saldo >= 0) {
                        coveredLatest += 1;
                    } else {
                        shortageLatest += Math.abs(value.saldo);
                    }
                }

                const coverageHours = getCoverageHoursForDay(row, latestDay);
                if (coverageHours !== null && Number.isFinite(coverageHours)) {
                    totalCoverageHours += coverageHours;
                    coverageHoursCount += 1;
                }
            }
        }

        const coveragePct = countedLatest > 0 ? (coveredLatest / countedLatest) * 100 : 0;
        const avgCoverageHours = coverageHoursCount > 0 ? totalCoverageHours / coverageHoursCount : 0;

        const lowCoverageTop5 = effectiveRows
            .map((row) => {
                let minHours: number | null = null;
                for (const day of effectiveDays) {
                    const coverage = getCoverageHoursForDay(row, day);
                    if (coverage === null) continue;
                    if (minHours === null || coverage < minHours) {
                        minHours = coverage;
                    }
                }

                if (minHours === null) return null;

                return {
                    np: row.np,
                    zone: row.zonaLogistica,
                    hours: Number(minHours.toFixed(2)),
                };
            })
            .filter((entry): entry is { np: string; zone: string; hours: number } => Boolean(entry))
            .sort((a, b) => a.hours - b.hours)
            .slice(0, 5)
            .map((entry) => ({
                ...entry,
                label: entry.np.length > 14 ? `${entry.np.slice(0, 14)}...` : entry.np,
            }));

        return {
            coveragePct: Number(coveragePct.toFixed(1)),
            coveredLatest,
            countedLatest,
            shortageLatest,
            usedLatest,
            avgCoverageHours: Number(avgCoverageHours.toFixed(2)),
            dailyTrend,
            lowCoverageTop5,
        };
    }, [effectiveDays, effectiveRows, latestDay]);

    const delayMetrics = useMemo(() => {
        const delays = Object.values(delayAssignments).filter((delay) => delay.minutes > 0);
        const totalMinutes = delays.reduce((acc, delay) => acc + delay.minutes, 0);
        const avgDelayMinutes = delays.length > 0 ? totalMinutes / delays.length : 0;
        return {
            delayedCycles: delays.length,
            avgDelayMinutes: Number(avgDelayMinutes.toFixed(1)),
        };
    }, [delayAssignments]);

    /** Agrupa retrasos por tipo (eventLabel) para mostrar "Tipo de problema". */
    const delayByType = useMemo(() => {
        const delays = Object.values(delayAssignments).filter((d) => d.minutes > 0);
        const byLabel: Record<string, { count: number; minutes: number }> = {};
        for (const d of delays) {
            const label = (d.eventLabel?.trim() || 'Sin clasificar');
            if (!byLabel[label]) byLabel[label] = { count: 0, minutes: 0 };
            byLabel[label].count += 1;
            byLabel[label].minutes += d.minutes;
        }
        return Object.entries(byLabel).map(([label, data]) => ({ label, ...data })).sort((a, b) => b.count - a.count);
    }, [delayAssignments]);

    const routeTableData = useMemo<RouteData[]>(() => {
        if (!routeRows.length) {
            return [];
        }

        const activeDay =
            projectionPlan?.projectedDays?.[projectionPlan.projectedDays.length - 1] ??
            routeServiceDate;

        const sortedRows = [...routeRows].sort((a, b) => a.cycleNumber - b.cycleNumber);
        let carriedDelayMinutes = 0;

        return sortedRows.map((row) => {
            const delayKey = activeDay ? `${activeDay}|${row.id}` : row.id;
            const delay = delayAssignments[delayKey] ?? delayAssignments[row.id];
            const eventDelayMinutes = delay?.minutes ?? 0;
            const totalDelayMinutes = carriedDelayMinutes + eventDelayMinutes;

            const plannedDate = new Date(row.vwArriveAt);
            const adjustedDate = new Date(plannedDate.getTime() + totalDelayMinutes * 60_000);

            let status: 'ok' | 'risk' | 'critical' = 'ok';
            if (totalDelayMinutes >= 30) {
                status = 'critical';
            } else if (totalDelayMinutes >= 10) {
                status = 'risk';
            }

            const output: RouteData = {
                id: `${row.routeCode}-C${String(row.cycleNumber).padStart(2, '0')}`,
                prov: row.supplierName,
                origin: row.supplierCode ?? 'PROVEEDOR',
                target: row.logisticZoneLabel,
                status,
                window: plannedDate.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'UTC',
                }),
                real: adjustedDate.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'UTC',
                }),
                delta: totalDelayMinutes,
                turno: row.turno,
            };

            carriedDelayMinutes += eventDelayMinutes;
            return output;
        });
    }, [routeRows, projectionPlan, routeServiceDate, delayAssignments]);

    /** Comparativa proveedor vs almacenista (cumplimiento a tiempo). */
    const comparativaProveedorAlmacenista = useMemo(() => {
        if (!routeTableData.length) {
            return { proveedor: { nombre: 'Proveedor', total: 0, aTiempo: 0, pct: 0 }, almacenista: { nombre: 'Almacenista / Planta', total: 0, aTiempo: 0, pct: 0 } };
        }
        const bySupplier: Record<string, { total: number; ok: number }> = {};
        const byZone: Record<string, { total: number; ok: number }> = {};
        for (const r of routeTableData) {
            bySupplier[r.prov] = (bySupplier[r.prov] || { total: 0, ok: 0 });
            bySupplier[r.prov].total += 1;
            if (r.status === 'ok') bySupplier[r.prov].ok += 1;
            byZone[r.target] = (byZone[r.target] || { total: 0, ok: 0 });
            byZone[r.target].total += 1;
            if (r.status === 'ok') byZone[r.target].ok += 1;
        }
        const supplierTotal = Object.values(bySupplier).reduce((s, v) => s + v.total, 0);
        const supplierOk = Object.values(bySupplier).reduce((s, v) => s + v.ok, 0);
        const zoneTotal = Object.values(byZone).reduce((s, v) => s + v.total, 0);
        const zoneOk = Object.values(byZone).reduce((s, v) => s + v.ok, 0);
        return {
            proveedor: { nombre: 'Proveedor', total: supplierTotal, aTiempo: supplierOk, pct: supplierTotal ? Math.round((supplierOk / supplierTotal) * 100) : 0 },
            almacenista: { nombre: 'Almacenista / Planta', total: zoneTotal, aTiempo: zoneOk, pct: zoneTotal ? Math.round((zoneOk / zoneTotal) * 100) : 0 },
        };
    }, [routeTableData]);

    /** Semáforo por horas de stock por pieza (último día): <2h rojo, 2-4h amarillo, >4h verde. */
    const semaphoreStockHours = useMemo(() => {
        let red = 0, yellow = 0, green = 0;
        if (!latestDay) return { red, yellow, green, total: 0 };
        for (const row of effectiveRows) {
            const hours = getCoverageHoursForDay(row, latestDay);
            if (hours === null || !Number.isFinite(hours)) continue;
            if (hours < 2) red += 1;
            else if (hours <= 4) yellow += 1;
            else green += 1;
        }
        return { red, yellow, green, total: red + yellow + green };
    }, [effectiveRows, latestDay]);

    const riskItems = useMemo(() => {
        const list: RiskItem[] = [];

        if (latestDay) {
            for (const row of effectiveRows) {
                const value = row.daily[latestDay];
                if (!value || typeof value.saldo !== 'number' || value.saldo >= 0) continue;
                const shortage = Math.abs(value.saldo);
                list.push({
                    id: `shortage-${row.id}-${latestDay}`,
                    type: 'crit',
                    title: `Faltante critico · ${row.np}`,
                    desc: `${row.zonaLogistica}: saldo ${value.saldo} pzas en ${formatDay(latestDay)}.`,
                    time: formatDay(latestDay),
                    route: row.np,
                    score: shortage,
                });
            }
        }

        for (const delay of Object.values(delayAssignments)) {
            if (delay.minutes <= 0) continue;
            list.push({
                id: `delay-${delay.serviceDate ?? 'base'}-${delay.rowId}`,
                type: delay.minutes >= 40 ? 'crit' : 'warn',
                title: `${delay.eventLabel?.trim() ? delay.eventLabel : 'Demora pendiente'} (+${delay.minutes} min)`,
                desc: `Ciclo ${delay.cycleNumber} · ${delay.routeCode} · ${delay.supplierName}.`,
                time: formatDateTime(delay.appliedAt),
                route: `${delay.routeCode}-C${String(delay.cycleNumber).padStart(2, '0')}`,
                score: delay.minutes,
            });
        }

        return list.sort((a, b) => b.score - a.score).slice(0, 8);
    }, [effectiveRows, latestDay, delayAssignments]);

    const coverageVariance = Number((metrics.coveragePct - COVERAGE_TARGET).toFixed(1));
    const coverageProgressWidth = Math.max(0, Math.min(100, metrics.coveragePct));

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-10 pb-10"
        >
            <div>
                <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight mb-1">Resumen de cumplimiento</h2>
                <p className="text-[var(--text-secondary)] text-sm font-medium max-w-2xl" role="doc-subtitle">
                    Cobertura por pieza y zona, indicadores clave e inventario proyectado. Usa los días inferiores para cambiar la fecha de análisis.
                </p>
            </div>
            <div className="flex items-center gap-6 glass-card p-4 rounded-2xl hud-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] pl-4">Días simulados</span>
                <div className="flex-1 flex gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                    {effectiveDays.slice(-9).map((day) => (
                        <button
                            key={day}
                            className={`flex-1 min-w-[90px] py-2 text-[10px] font-black rounded-xl transition-all ${day === latestDay
                                ? 'bg-[#001e50] dark:bg-blue-600 text-white shadow-lg'
                                : 'bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]'
                                }`}
                        >
                            {formatDay(day)}
                        </button>
                    ))}
                    {!effectiveDays.length && (
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                            Sin datos de simulacion
                        </div>
                    )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] pr-2">
                    Update: {lastUpdated ? formatDateTime(lastUpdated) : '--:--'}
                </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card rounded-2xl p-5 border border-blue-500/20 flex items-center gap-4 hover:shadow-lg transition-shadow"
                >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Gauge size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Cobertura</p>
                        <p className="text-2xl font-black text-[var(--text-primary)]">{metrics.coveragePct}%</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">piezas con stock ok</p>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="glass-card rounded-2xl p-5 border border-amber-500/20 flex items-center gap-4 hover:shadow-lg transition-shadow"
                >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Retrasos</p>
                        <p className="text-2xl font-black text-[var(--text-primary)]">{delayMetrics.delayedCycles}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">ciclos con demora</p>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="glass-card rounded-2xl p-5 border border-emerald-500/20 flex items-center gap-4 hover:shadow-lg transition-shadow"
                >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Truck size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Proveedor</p>
                        <p className="text-2xl font-black text-[var(--text-primary)]">{comparativaProveedorAlmacenista.proveedor.pct}%</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{comparativaProveedorAlmacenista.proveedor.aTiempo} de {comparativaProveedorAlmacenista.proveedor.total} a tiempo</p>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="glass-card rounded-2xl p-5 border border-cyan-500/20 flex items-center gap-4 hover:shadow-lg transition-shadow"
                >
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                        <Warehouse size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Almacenista</p>
                        <p className="text-2xl font-black text-[var(--text-primary)]">{comparativaProveedorAlmacenista.almacenista.pct}%</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{comparativaProveedorAlmacenista.almacenista.aTiempo} de {comparativaProveedorAlmacenista.almacenista.total} a tiempo</p>
                    </div>
                </motion.div>
            </div>

            {/* Bloques para manejo de negocio: tipo de retraso, cantidad de material, comparativa */}
            <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight mb-3 flex items-center gap-2">
                    <span className="w-1 h-5 bg-emerald-500 rounded-full" aria-hidden />
                    Para manejo de negocio
                </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                    className="glass-card rounded-[2rem] p-6 hud-border border-amber-500/10 hover:shadow-lg transition-shadow"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Tipo de problema (retrasos)</h3>
                            <p className="text-[11px] text-[var(--text-secondary)]">Clasificación de demoras por causa.</p>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {delayByType.length === 0 ? (
                            <p className="text-[11px] text-[var(--text-secondary)] font-medium py-2">Sin retrasos registrados.</p>
                        ) : (
                            delayByType.map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-2 px-3 rounded-xl bg-black/5 dark:bg-white/5">
                                    <span className="text-xs font-bold text-[var(--text-primary)] truncate pr-2">{item.label}</span>
                                    <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 shrink-0">{item.count} · {item.minutes} min</span>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.25 }}
                    className="glass-card rounded-[2rem] p-6 hud-border border-cyan-500/10 hover:shadow-lg transition-shadow"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                            <Boxes size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Cantidad de material</h3>
                            <p className="text-[11px] text-[var(--text-secondary)]">Qué ocasiona: cambio de ruta o faltante.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                                <Route size={16} className="text-cyan-600 dark:text-cyan-400" />
                                Ocasiona cambio de ruta
                            </span>
                            <span className="text-lg font-black text-cyan-600 dark:text-cyan-400">{delayMetrics.delayedCycles}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                                <Package size={16} className="text-red-600 dark:text-red-400" />
                                Ocasiona faltante / cantidad
                            </span>
                            <span className="text-lg font-black text-red-600 dark:text-red-400">{Math.round(metrics.shortageLatest)}</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                    className="glass-card rounded-[2rem] p-6 hud-border border-slate-200 dark:border-slate-600 hover:shadow-lg transition-shadow"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                            <div className="flex gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Semáforo por horas de stock</h3>
                            <p className="text-[11px] text-[var(--text-secondary)]">Por pieza-zona (último día). &lt;2h rojo, 2–4h amarillo, &gt;4h verde.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">&lt; 2 h stock</span>
                            </span>
                            <span className="text-xl font-black text-red-600 dark:text-red-400">{semaphoreStockHours.red}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">2 – 4 h stock</span>
                            </span>
                            <span className="text-xl font-black text-amber-600 dark:text-amber-400">{semaphoreStockHours.yellow}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">&gt; 4 h stock</span>
                            </span>
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{semaphoreStockHours.green}</span>
                        </div>
                        <div className="pt-2 border-t border-[var(--border-color)] flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                            <span>Piezas-zona con dato</span>
                            <span>{semaphoreStockHours.total}</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="lg:col-span-2 glass-card rounded-[2.5rem] p-10 relative overflow-hidden group hud-border transition-shadow duration-300 hover:shadow-xl"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 blur-[120px] -mr-32 -mt-32 transition-all duration-500 bg-blue-600/10 opacity-30 group-hover:opacity-50"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div className="space-y-1">
                                <h2 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">Cobertura de piezas hoy</h2>
                                <p className="text-sm text-[var(--text-secondary)] font-medium">¿Cuántas piezas tienen stock suficiente? La meta es 95%.</p>
                                <p className="text-[11px] text-[var(--text-secondary)] mt-2 flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Verde = bien</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Rojo = hay que actuar</span>
                                </p>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-600 text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm shrink-0">
                                <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                                Actualización continua
                            </div>
                        </div>

                        <div className="flex items-end gap-6 mb-8">
                            <div>
                                <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1">Porcentaje cubierto</p>
                                <h2 className="text-9xl font-black tracking-tighter leading-none italic text-[var(--text-primary)]">
                                    {metrics.coveragePct}
                                    <span className="text-5xl text-blue-600/40 not-italic ml-2">%</span>
                                </h2>
                            </div>
                            <div className="flex flex-col mb-2">
                                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Respecto a la meta 95%</p>
                                <div className={`flex items-center gap-1.5 text-sm font-black px-4 py-2 rounded-2xl border shadow-sm ${coverageVariance >= 0
                                    ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                                    : 'text-red-600 bg-red-500/10 border-red-500/20'
                                    }`}>
                                    <Gauge size={18} />
                                    {coverageVariance >= 0 ? '+' : ''}{coverageVariance}%
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-2">
                                    {coverageVariance >= 0 ? 'Por encima del objetivo' : `Faltan ${Math.abs(coverageVariance)} puntos para llegar al 95%`}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Barra: de 0% a 100% (meta 95%)</p>
                                <div className="h-4 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden p-1 border border-[var(--border-color)]">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${coverageProgressWidth}%` }}
                                        transition={{ duration: 1.2, ease: 'circOut' }}
                                        className="h-full bg-gradient-to-r from-[#001e50] via-blue-700 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                    ></motion.div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)]">
                                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1">Con stock OK</p>
                                    <p className="text-xl font-black text-[var(--text-primary)]">{metrics.coveredLatest} de {metrics.countedLatest || summary?.totalPartZones || 0}</p>
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">piezas-zona con stock suficiente</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border-color)]">
                                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-1">Día mostrado</p>
                                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{latestDay ? formatDay(latestDay) : '--'}</p>
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">fecha de los datos</p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Piezas que faltan</p>
                                    <p className="text-xl font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                                        <ShieldAlert size={20} />
                                        {Math.round(metrics.shortageLatest).toLocaleString('es-MX')}
                                    </p>
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">unidades en negativo (faltante)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                    className="grid grid-cols-2 gap-6"
                >
                    <StatCard label="Partes" value={summary?.totalPartZones ?? effectiveRows.length} icon={<Package size={22} />} color="blue" hint="Piezas-zona monitoreadas." />
                    <StatCard label="Prom Hrs Stock" value={`${metrics.avgCoverageHours}h`} icon={<Clock3 size={22} />} color="cyan" hint="Promedio de horas de stock por pieza." />
                    <StatCard label="Uso Ult. Dia" value={Math.round(metrics.usedLatest)} icon={<Activity size={22} />} color="yellow" hint="Piezas consumidas en el último día." />
                    <StatCard label="Delay Prom." value={`${delayMetrics.avgDelayMinutes}m`} icon={<AlertTriangle size={22} />} color="red" hint="Retraso promedio en ciclos con demora." />
                </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="glass-card rounded-[2.5rem] p-10 hud-border transition-shadow duration-300 hover:shadow-lg"
                >
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-blue-600 rounded-full" aria-hidden></div>
                                Fluctuación diaria: uso vs faltante
                            </h3>
                            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1.5 opacity-90">Consumo y piezas en negativo por día.</p>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics.dailyTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis dataKey="label" stroke={textColor} fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} dy={10} />
                                <YAxis stroke={textColor} fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} dx={-10} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isDark ? '#0f172a' : '#fff',
                                        border: 'none',
                                        borderRadius: '16px',
                                        fontSize: '10px',
                                        fontWeight: '900',
                                        boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.2)',
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 900 }} />
                                <Line type="monotone" dataKey="used" name="Uso diario" stroke={isDark ? '#60a5fa' : '#001e50'} strokeWidth={3} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="shortage" name="Faltante" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.12 }}
                    className="glass-card rounded-[2.5rem] p-10 hud-border transition-shadow duration-300 hover:shadow-lg"
                >
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-cyan-500 rounded-full" aria-hidden></div>
                                Top 5 piezas con menos horas de stock
                            </h3>
                            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1.5 opacity-90">Priorizar reabastecimiento.</p>
                        </div>
                    </div>
                    <div className="h-80">
                        {metrics.lowCoverageTop5.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                                No hay datos de cobertura todavia
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics.lowCoverageTop5} layout="vertical" margin={{ left: 18, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                                    <XAxis type="number" stroke={textColor} fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                    <YAxis type="category" dataKey="label" width={130} stroke={textColor} fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: isDark ? '#0f172a' : '#fff',
                                            border: 'none',
                                            borderRadius: '16px',
                                            fontSize: '10px',
                                            fontWeight: '900',
                                            boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.2)',
                                        }}
                                    />
                                    <Bar dataKey="hours" name="Horas" fill={isDark ? '#06b6d4' : '#0e7490'} radius={[0, 8, 8, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.14 }}
                    className="xl:col-span-2"
                >
                    <LogisticsTable data={routeTableData} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.16 }}
                    className="glass-card rounded-[2.5rem] p-10 hud-border bg-red-500/[0.02] border-red-500/10 h-full transition-shadow duration-300 hover:shadow-lg"
                >
                    <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-tight border-b border-red-500/10 pb-4 flex items-center gap-3">
                        <ShieldAlert size={20} aria-hidden />
                        Riesgos operativos
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-3 mb-6 opacity-90">Faltantes críticos y demoras que requieren atención.</p>

                    {loading && (
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">Cargando metricas...</p>
                    )}

                    {error && (
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                            {riskItems.length === 0 && (
                                <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                                    Sin riesgos criticos detectados por el momento.
                                </div>
                            )}
                            {riskItems.map((item, i) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05, duration: 0.25 }}
                                    className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-md relative overflow-hidden group hover:border-red-500/30 hover:shadow-lg transition-all duration-200"
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-xl group-hover:bg-red-500/20 transition-all duration-300"></div>
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${item.type === 'crit' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                            {item.type === 'crit' ? <ShieldAlert size={12} aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
                                            {item.route}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400 font-black">{item.time}</span>
                                    </div>
                                    <h4 className="text-sm font-black text-[var(--text-primary)] uppercase mb-2 leading-tight tracking-tight">{item.title}</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-bold">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="glass-card rounded-[2rem] px-8 py-5 border border-blue-500/20 bg-blue-500/[0.03]"
            >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-400">
                    Cobertura calculada con el saldo del último día disponible. Uso y faltante se actualizan con inventario real y proyección activa.
                </p>
            </motion.div>
        </motion.div>
    );
};
