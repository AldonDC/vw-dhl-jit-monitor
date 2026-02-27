import React from 'react';
import { Truck } from 'lucide-react';
import type { RouteData } from '../types';

interface LogisticsTableProps {
    data: RouteData[];
}

export const LogisticsTable: React.FC<LogisticsTableProps> = ({ data }) => {
    return (
        <div className="glass-card rounded-[2.5rem] overflow-hidden hud-border flex flex-col h-full">
            <div className="p-8 border-b border-[var(--border-color)] flex justify-between items-center bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                        <Truck size={22} />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">JIT Logistics Stream</h3>
                        <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase mt-1 tracking-widest">Puebla Terminal Monitor</p>
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-black/5 dark:bg-white/5 text-[var(--text-secondary)] font-black uppercase tracking-widest">
                        <tr>
                            <th className="px-10 py-5">Provider</th>
                            <th className="px-6 py-5">Route</th>
                            <th className="px-6 py-5">Window</th>
                            <th className="px-6 py-5">Actual</th>
                            <th className="px-6 py-5">Variance</th>
                            <th className="px-10 py-5 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] text-[11px] font-bold">
                        {data.map((r, i) => (
                            <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                <td className="px-10 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center font-black text-[9px] text-[var(--text-secondary)] group-hover:bg-[#001e50] group-hover:text-white transition-all shadow-sm">
                                            {r.prov.charAt(0)}
                                        </div>
                                        <span className="text-[var(--text-primary)] uppercase tracking-tight">{r.prov}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 font-mono text-[var(--text-secondary)]">{r.id}</td>
                                <td className="px-6 py-5 text-blue-600 font-black">{r.window}</td>
                                <td className="px-6 py-5 text-emerald-600 font-black">{r.real}</td>
                                <td className={`px-6 py-5 font-black italic ${r.delta > 15 ? 'text-red-500' : r.delta > 0 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                                    {r.delta > 0 ? `+${r.delta}` : r.delta} MIN
                                </td>
                                <td className="px-10 py-5 text-right">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${r.status === 'ok' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                            r.status === 'risk' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                                                'bg-red-500/10 text-red-600 border-red-500/20'
                                        }`}>
                                        {r.status === 'ok' ? 'Optimal' : r.status === 'risk' ? 'Warning' : 'Critical'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
