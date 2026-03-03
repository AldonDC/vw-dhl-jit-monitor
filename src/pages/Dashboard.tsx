import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock3, ShieldAlert, Activity, AlertTriangle, Gauge } from 'lucide-react';
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
            transition={{ duration: 0.5 }}
            className="space-y-10 pb-10"
        >
            <div className="flex items-center gap-6 glass-card p-4 rounded-2xl hud-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] pl-4">Dias simulados</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card rounded-[2.5rem] p-10 relative overflow-hidden group hud-border">
                    <div className="absolute top-0 right-0 w-96 h-96 blur-[120px] -mr-32 -mt-32 transition-all duration-700 bg-blue-600/10 opacity-30 group-hover:opacity-50"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-10">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-blue-600 tracking-[0.4em] uppercase leading-none">Coverage Monitor</span>
                                <h2 className="text-sm font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-2">Cobertura General de Piezas</h2>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-600 text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">
                                <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                                Actualizacion continua
                            </div>
                        </div>

                        <div className="flex items-end gap-6 mb-12">
                            <h2 className="text-9xl font-black tracking-tighter leading-none italic text-[var(--text-primary)]">
                                {metrics.coveragePct}
                                <span className="text-5xl text-blue-600/40 not-italic ml-2">%</span>
                            </h2>
                            <div className="flex flex-col mb-3">
                                <div className={`flex items-center gap-1 text-sm font-black px-4 py-1.5 rounded-2xl border shadow-sm ${coverageVariance >= 0
                                    ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                                    : 'text-red-600 bg-red-500/10 border-red-500/20'
                                    }`}>
                                    <Gauge size={16} />
                                    {coverageVariance >= 0 ? '+' : ''}{coverageVariance}%
                                </div>
                                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase mt-3 ml-1 tracking-[0.2em]">
                                    Vs objetivo {COVERAGE_TARGET}%
                                </span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="h-4 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden p-1 border border-[var(--border-color)]">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${coverageProgressWidth}%` }}
                                    transition={{ duration: 1.2, ease: 'circOut' }}
                                    className="h-full bg-gradient-to-r from-[#001e50] via-blue-700 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                ></motion.div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black tracking-[0.1em] uppercase">
                                <div className="flex gap-4">
                                    <span className="text-[var(--text-secondary)]">Piezas cubiertas: <span className="text-[var(--text-primary)]">{metrics.coveredLatest}/{metrics.countedLatest || summary?.totalPartZones || 0}</span></span>
                                    <span className="text-[var(--text-secondary)]">Dia actual: <span className="text-blue-600">{latestDay ? formatDay(latestDay) : '--'}</span></span>
                                </div>
                                <span className="text-red-500 flex items-center gap-2 bg-red-500/5 px-3 py-1 rounded-lg border border-red-500/10">
                                    <ShieldAlert size={14} />
                                    Faltante: {Math.round(metrics.shortageLatest)} pzas
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <StatCard label="Partes" value={summary?.totalPartZones ?? effectiveRows.length} icon={<Package size={22} />} color="blue" />
                    <StatCard label="Prom Hrs Stock" value={`${metrics.avgCoverageHours}h`} icon={<Clock3 size={22} />} color="cyan" />
                    <StatCard label="Uso Ult. Dia" value={Math.round(metrics.usedLatest)} icon={<Activity size={22} />} color="yellow" />
                    <StatCard label="Delay Prom." value={`${delayMetrics.avgDelayMinutes}m`} icon={<AlertTriangle size={22} />} color="red" />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="glass-card rounded-[2.5rem] p-10 hud-border">
                    <div className="flex justify-between items-center mb-12">
                        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                            Fluctuacion diaria: uso vs faltante
                        </h3>
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
                </div>

                <div className="glass-card rounded-[2.5rem] p-10 hud-border">
                    <div className="flex justify-between items-center mb-12">
                        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-cyan-500 rounded-full"></div>
                            Top 5 piezas con menor horas de stock
                        </h3>
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
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                    <LogisticsTable data={routeTableData} />
                </div>

                <div className="glass-card rounded-[2.5rem] p-10 hud-border bg-red-500/[0.02] border-red-500/10 h-full">
                    <h3 className="text-xs font-black text-red-600 uppercase tracking-[0.2em] mb-10 border-b border-red-500/10 pb-4 flex items-center gap-3">
                        <ShieldAlert size={18} />
                        Operational Risk Feed
                    </h3>

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
                                    transition={{ delay: i * 0.06 }}
                                    className="p-8 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl relative overflow-hidden group hover:border-red-500/30 transition-all hover:translate-x-1"
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-xl group-hover:bg-red-500/20 transition-all"></div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${item.type === 'crit' ? 'text-red-600' : 'text-yellow-600'}`}>
                                            {item.route}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400 font-black">{item.time}</span>
                                    </div>
                                    <h4 className="text-sm font-black text-[var(--text-primary)] uppercase mb-3 leading-tight tracking-tight">{item.title}</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-bold">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="glass-card rounded-[2rem] px-8 py-5 border border-blue-500/20 bg-blue-500/[0.03]">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-400">
                    Cobertura general calculada con saldo del ultimo dia disponible. Uso/faltante diario se actualiza con datos reales de inventario y proyeccion activa.
                </p>
            </div>
        </motion.div>
    );
};
