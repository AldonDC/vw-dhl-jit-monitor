import React from 'react';
import { motion } from 'framer-motion';
import { Package, Truck, Clock, ShieldAlert, ChevronRight } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { LogisticsTable } from '../components/LogisticsTable';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { ROUTES_DATA, ALERTS_DATA, KPI_DATA } from '../data/mockData';

interface DashboardProps {
    theme: 'light' | 'dark';
}

export const Dashboard: React.FC<DashboardProps> = ({ theme }) => {
    const isDark = theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#475569';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-10 pb-10"
        >
            {/* Time Simulation Hud */}
            <div className="flex items-center gap-6 glass-card p-4 rounded-2xl hud-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] pl-4">Time Simulation</span>
                <div className="flex-1 flex gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                    {['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map((time, i) => (
                        <button
                            key={i}
                            className={`flex-1 min-w-[70px] py-2 text-[10px] font-black rounded-xl transition-all ${time === '16:00'
                                    ? 'bg-[#001e50] dark:bg-blue-600 text-white shadow-lg'
                                    : 'bg-black/5 dark:bg-white/5 text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10'
                                }`}
                        >
                            {time}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main KPI Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card rounded-[2.5rem] p-10 relative overflow-hidden group hud-border">
                    <div className="absolute top-0 right-0 w-96 h-96 blur-[120px] -mr-32 -mt-32 transition-all duration-700 bg-blue-600/10 opacity-30 group-hover:opacity-50"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-10">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-blue-600 tracking-[0.4em] uppercase leading-none">Global Compliance Matrix</span>
                                <h2 className="text-sm font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-2">Just-In-Time Operations</h2>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-600 text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">
                                <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                                Real-Time Live
                            </div>
                        </div>

                        <div className="flex items-end gap-6 mb-12">
                            <h2 className="text-9xl font-black tracking-tighter leading-none italic text-[var(--text-primary)]">
                                {KPI_DATA.compliance}
                                <span className="text-5xl text-blue-600/40 not-italic ml-2">%</span>
                            </h2>
                            <div className="flex flex-col mb-3">
                                <div className="flex items-center gap-1 text-emerald-600 text-sm font-black bg-emerald-500/10 px-4 py-1.5 rounded-2xl border border-emerald-500/20 shadow-sm">
                                    <ChevronRight size={18} className="-rotate-90" />
                                    +2.4%
                                </div>
                                <span className="text-[9px] text-[var(--text-secondary)] font-black uppercase mt-3 ml-1 tracking-[0.2em]">Vs Previous Shift</span>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="h-4 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden p-1 border border-[var(--border-color)]">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${KPI_DATA.compliance}%` }}
                                    transition={{ duration: 1.8, ease: "circOut" }}
                                    className="h-full bg-gradient-to-r from-[#001e50] via-blue-700 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                ></motion.div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black tracking-[0.1em] uppercase">
                                <div className="flex gap-4">
                                    <span className="text-[var(--text-secondary)]">Target: <span className="text-[var(--text-primary)]">98.0%</span></span>
                                    <span className="text-[var(--text-secondary)]">Current: <span className="text-blue-600">{KPI_DATA.compliance}%</span></span>
                                </div>
                                <span className="text-red-500 flex items-center gap-2 bg-red-500/5 px-3 py-1 rounded-lg border border-red-500/10">
                                    <ShieldAlert size={14} />
                                    Variance: -5.2%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <StatCard label="Programmed" value={KPI_DATA.collections_total} icon={<Package size={22} />} color="blue" />
                    <StatCard label="Diesel Est." value={`${KPI_DATA.diesel_estimated}L`} icon={<Truck size={22} />} color="cyan" />
                    <StatCard label="Avg. Delay" value={`${KPI_DATA.avg_delay}m`} icon={<Clock size={22} />} color="yellow" />
                    <StatCard label="Critical Fail" value={KPI_DATA.collections_fail} icon={<ShieldAlert size={22} />} color="red" />
                </div>
            </div>

            {/* Analytics Hud */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="glass-card rounded-[2.5rem] p-10 hud-border">
                    <div className="flex justify-between items-center mb-12">
                        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                            Shift Compliance Analytics
                        </h3>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[{ n: 'SHIFT 01', v: 96 }, { n: 'SHIFT 02', v: 88 }, { n: 'SHIFT 03', v: 92 }]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis dataKey="n" stroke={textColor} fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} dy={10} />
                                <YAxis stroke={textColor} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fontWeight: 900 }} dx={-10} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: 'none', borderRadius: '16px', fontSize: '10px', fontWeight: '900', boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.2)' }}
                                />
                                <Bar dataKey="v" fill={isDark ? "#3b82f6" : "#001e50"} radius={[6, 6, 0, 0]} barSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card rounded-[2.5rem] p-10 hud-border">
                    <div className="flex justify-between items-center mb-12">
                        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-cyan-500 rounded-full"></div>
                            Weekly Operational Trend
                        </h3>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[
                                { d: 'MON', r: 94, p: 98 }, { d: 'TUE', r: 92, p: 98 }, { d: 'WED', r: 95, p: 98 },
                                { d: 'THU', r: 93, p: 98 }, { d: 'FRI', r: 88, p: 98 }, { d: 'SAT', r: 91, p: 98 },
                                { d: 'SUN', r: 92, p: 98 }
                            ]}>
                                <defs>
                                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isDark ? "#3b82f6" : "#001e50"} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={isDark ? "#3b82f6" : "#001e50"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis dataKey="d" stroke={textColor} fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} dy={10} />
                                <YAxis stroke={textColor} fontSize={10} tickLine={false} axisLine={false} domain={[80, 100]} tick={{ fontWeight: 900 }} dx={-10} />
                                <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', border: 'none', borderRadius: '16px', fontSize: '10px', fontWeight: '900', boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.2)' }} />
                                <Area type="monotone" dataKey="r" stroke={isDark ? "#3b82f6" : "#001e50"} fillOpacity={1} fill="url(#colorReal)" strokeWidth={5} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tables and Alerts Hud */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                    <LogisticsTable data={ROUTES_DATA} />
                </div>

                <div className="glass-card rounded-[2.5rem] p-10 hud-border bg-red-500/[0.02] border-red-500/10 h-full">
                    <h3 className="text-xs font-black text-red-600 uppercase tracking-[0.2em] mb-10 border-b border-red-500/10 pb-4 flex items-center gap-3">
                        <ShieldAlert size={18} />
                        Critical Exceptions
                    </h3>
                    <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {ALERTS_DATA.filter(a => a.type === 'crit').map((alert, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="p-8 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl relative overflow-hidden group hover:border-red-500/30 transition-all hover:translate-x-1"
                            >
                                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-xl group-hover:bg-red-500/20 transition-all"></div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">{alert.route}</span>
                                    <span className="text-[10px] font-mono text-slate-400 font-black">{alert.time}</span>
                                </div>
                                <h4 className="text-sm font-black text-[var(--text-primary)] uppercase mb-3 leading-tight tracking-tight">{alert.title}</h4>
                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-bold">{alert.desc}</p>
                                <div className="mt-6 flex gap-3">
                                    <button className="flex-1 py-2.5 bg-red-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 active:scale-95">
                                        Investigate
                                    </button>
                                    <button className="px-4 py-2.5 bg-black/5 dark:bg-white/5 text-[var(--text-primary)] text-[10px] font-black uppercase rounded-2xl hover:bg-black/10 transition-all active:scale-95">
                                        Skip
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
