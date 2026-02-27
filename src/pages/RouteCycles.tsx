import React from 'react';
import { motion } from 'framer-motion';
import { Route as RouteIcon, MapPin, Clock, Gauge, ArrowRight } from 'lucide-react';

interface MetricBoxProps {
    label: string;
    value: string;
    sub: string;
    color: 'blue' | 'yellow' | 'red';
    icon: React.ReactNode;
}

const MetricBox: React.FC<MetricBoxProps> = ({ label, value, sub, color, icon }) => {
    const colors = {
        blue: 'text-blue-600 dark:text-blue-400',
        yellow: 'text-yellow-600 dark:text-yellow-400',
        red: 'text-red-500',
    };
    return (
        <div className="glass-card p-8 rounded-[2rem] group hover:translate-y-[-5px] transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
                <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] group-hover:text-current transition-colors">{label}</span>
                <div className={`scale-90 opacity-40 group-hover:opacity-100 transition-all ${colors[color]}`}>{icon}</div>
            </div>
            <p className={`text-4xl font-black mt-2 tracking-tighter ${colors[color]}`}>{value}</p>
            <p className="text-[10px] text-[var(--text-secondary)] font-black mt-2 uppercase tracking-widest leading-none">{sub}</p>
        </div>
    );
};

export const RouteCycles: React.FC = () => {
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
                        <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-tight">Ruta T28 · AKsys / FINSA</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-blue-600 font-black uppercase tracking-[0.3em]">Operational Cycle</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Nave 21 Destination</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="bg-emerald-500/10 text-emerald-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/40"></div>
                        On Schedule
                    </div>
                    <button className="bg-black/5 dark:bg-white/5 border border-[var(--border-color)] text-[10px] font-black uppercase tracking-widest rounded-2xl px-6 py-3 text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center gap-2">
                        Switch Route <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/[0.03] blur-[120px] -mr-32 -mt-32"></div>
                <div className="flex justify-between items-center mb-16 border-b border-[var(--border-color)] pb-6 relative z-10">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Operational Cycle Timeline</h3>
                    <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-[9px] font-black uppercase text-slate-400">Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></div>
                            <span className="text-[9px] font-black uppercase text-slate-400">Current</span>
                        </div>
                    </div>
                </div>

                <div className="relative h-40 flex items-center px-10 relative z-10">
                    <div className="absolute h-1.5 w-[calc(100%-80px)] bg-black/5 dark:bg-white/5 rounded-full left-10"></div>
                    <div className="absolute h-1.5 w-[calc(75%-60px)] bg-gradient-to-r from-blue-700 to-cyan-500 rounded-full left-10 shadow-[0_0_20px_rgba(59,130,246,0.3)]"></div>

                    <div className="absolute w-full px-10 flex justify-between left-0">
                        {[
                            { l: 'Salida', t: '15:30', s: 'ok', desc: 'Exit Terminal' },
                            { l: 'FINSA', t: '15:55', s: 'ok', desc: 'Vendor Collect' },
                            { l: 'Puerta 3', t: '16:15', s: 'ok', desc: 'Plant Gate' },
                            { l: 'Nave 21', t: '16:45', s: 'current', desc: 'Docking' },
                            { l: 'Cierre', t: '17:15', s: 'future', desc: 'Verification' }
                        ].map((step, i) => (
                            <div key={i} className="flex flex-col items-center group/step cursor-default">
                                <div className={`w-10 h-10 rounded-2xl border-4 border-[var(--bg-surface)] z-10 shadow-2xl transition-all duration-500 flex items-center justify-center ${step.s === 'ok' ? 'bg-emerald-500 text-white' :
                                        step.s === 'current' ? 'bg-blue-600 scale-125 ring-8 ring-blue-500/10 text-white' :
                                            'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                    {step.s === 'ok' ? <MapPin size={16} /> : i + 1}
                                </div>
                                <div className="text-center mt-6 transition-transform duration-300 group-hover/step:-translate-y-1">
                                    <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">{step.l}</p>
                                    <p className="text-[10px] font-mono font-black text-blue-600 mt-1">{step.t}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 opacity-0 group-hover/step:opacity-100 transition-all duration-300">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <MetricBox label="Delta Variance" value="+12 min" sub="Stable Flow" color="yellow" icon={<Clock size={24} />} />
                <MetricBox label="Plant ETA" value="17:05" sub="GPS Calculated" color="blue" icon={<MapPin size={24} />} />
                <MetricBox label="Destination" value="NAVE 21" sub="Logistic Zone E" color="blue" icon={<RouteIcon size={24} />} />
                <MetricBox label="Current Speed" value="45 km/h" sub="Fleet Average" color="blue" icon={<Gauge size={24} />} />
            </div>
        </motion.div>
    );
};
