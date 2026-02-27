import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Info, Bell, CheckCircle2 } from 'lucide-react';
import { ALERTS_DATA } from '../data/mockData';

export const Alerts: React.FC = () => {
    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-10 pb-10"
        >
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h2 className="text-4xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Alert Center</h2>
                    <p className="text-[11px] text-red-600 font-black uppercase tracking-[0.3em] mt-3 bg-red-500/5 px-4 py-2 rounded-xl border border-red-500/10 inline-block">
                        {ALERTS_DATA.filter(a => a.type === 'crit').length} Critical Issues Detected
                    </p>
                </div>
                <div className="flex gap-4">
                    <button className="px-6 py-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all">Clear Resolved</button>
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.05] transition-all">Dispatch Help</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence>
                    {ALERTS_DATA.map((a, i) => (
                        <motion.div
                            key={a.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -10 }}
                            className={`p-10 rounded-[2.5rem] border shadow-2xl relative overflow-hidden group transition-all ${a.type === 'crit' ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' :
                                    a.type === 'warn' ? 'bg-yellow-50/50 dark:bg-yellow-500/5 border-yellow-200 dark:border-yellow-500/20' :
                                        'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20'
                                }`}
                        >
                            <div className="absolute top-0 right-0 w-40 h-40 bg-current opacity-[0.03] -mr-16 -mt-16 rounded-full transition-transform group-hover:scale-150 duration-700"></div>

                            <div className="flex justify-between items-start mb-8">
                                <div className={`p-4 rounded-2xl shadow-xl transition-transform group-hover:rotate-12 duration-500 ${a.type === 'crit' ? 'bg-red-500 text-white shadow-red-500/20' :
                                        a.type === 'warn' ? 'bg-yellow-500 text-white shadow-yellow-500/20' :
                                            'bg-blue-600 text-white shadow-blue-500/20'
                                    }`}>
                                    {a.type === 'crit' ? <ShieldAlert size={28} /> : a.type === 'warn' ? <AlertTriangle size={28} /> : <Info size={28} />}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-mono text-slate-400 font-black bg-white/80 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/5">{a.time}</span>
                                    <span className="text-[9px] font-black uppercase text-slate-400 mt-2 tracking-widest leading-none">Detected TS-42</span>
                                </div>
                            </div>

                            <h4 className="font-black text-[var(--text-primary)] mb-3 uppercase tracking-tighter italic text-2xl leading-tight group-hover:text-blue-600 transition-colors">{a.title}</h4>
                            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-8 font-bold opacity-80 group-hover:opacity-100 transition-opacity">{a.desc}</p>

                            <div className="flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-8">
                                <span className="text-[10px] font-black bg-white dark:bg-black/40 px-4 py-2 rounded-xl uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border border-black/5 shadow-sm">{a.route}</span>
                                <button className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest group/btn">
                                    Resolve <CheckCircle2 size={16} className="group-hover/btn:scale-125 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <div className="glass-card p-12 rounded-[3rem] mt-20 flex flex-col md:flex-row items-center gap-10 border-blue-500/10">
                <div className="w-24 h-24 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 shadow-inner">
                    <Bell size={40} className="animate-bounce" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter italic">Notification Management</h3>
                    <p className="text-sm font-bold text-[var(--text-secondary)] mt-2">All operational teams are synced with this dispatch tower. Real-time geofence alerts are enabled.</p>
                </div>
                <button className="px-10 py-5 bg-[#001e50] text-white font-black uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-blue-900/40 hover:scale-[1.05] transition-all">Configure Alerts</button>
            </div>
        </motion.div>
    );
};
