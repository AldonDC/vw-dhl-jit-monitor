import React from 'react';
import { Truck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { RouteData } from '../types';

interface LogisticsTableProps {
    data: RouteData[];
}

function StatusBadge({ status }: { status: RouteData['status'] }) {
    if (status === 'ok') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 size={12} aria-hidden /> A tiempo
            </span>
        );
    }
    if (status === 'risk') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400">
                <AlertTriangle size={12} aria-hidden /> Riesgo
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400">
            <XCircle size={12} aria-hidden /> Crítico
        </span>
    );
}

export const LogisticsTable: React.FC<LogisticsTableProps> = ({ data }) => {
    return (
        <div className="glass-card rounded-[2.5rem] overflow-hidden hud-border flex flex-col h-full transition-shadow duration-300 hover:shadow-lg">
            <div className="p-8 border-b border-[var(--border-color)] flex justify-between items-center bg-black/[0.01] dark:bg-white/[0.01] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 shrink-0">
                        <Truck size={24} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Flujo de rutas JIT</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase mt-0.5 tracking-widest">Puebla · Terminal Monitor</p>
                        <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-2 opacity-90 max-w-md">Ventana programada vs hora real de llegada por ciclo. Desvío en minutos.</p>
                    </div>
                </div>
            </div>
            <div className="overflow-auto flex-1 min-h-0 max-h-[520px] custom-scrollbar">
                <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="sticky top-0 z-10 bg-[var(--bg-surface)] shadow-[0_1px_0_0_var(--border-color)]">
                        <tr>
                            <th className="px-6 py-4 text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">Proveedor</th>
                            <th className="px-6 py-4 text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">Ruta</th>
                            <th className="px-6 py-4 text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">Ventana</th>
                            <th className="px-6 py-4 text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">Real</th>
                            <th className="px-6 py-4 text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">Desvío</th>
                            <th className="px-6 py-4 text-right text-[var(--text-secondary)] font-black uppercase tracking-widest text-[10px]">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] text-[11px] font-bold">
                        {data.map((r, i) => (
                            <tr
                                key={i}
                                className={`transition-colors duration-200 group ${i % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.02] dark:bg-white/[0.02]'} hover:bg-blue-500/[0.06] dark:hover:bg-blue-500/10`}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center font-black text-[10px] text-[var(--text-secondary)] group-hover:bg-[#001e50] group-hover:text-white transition-all duration-200 shadow-sm">
                                            {r.prov.charAt(0)}
                                        </div>
                                        <span className="text-[var(--text-primary)] font-semibold tracking-tight">{r.prov}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-[var(--text-secondary)]">{r.id}</td>
                                <td className="px-6 py-4 text-blue-600 dark:text-blue-400 font-black">{r.window}</td>
                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-black">{r.real}</td>
                                <td className={`px-6 py-4 font-black ${r.delta > 15 ? 'text-red-500' : r.delta > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {r.delta > 0 ? `+${r.delta}` : r.delta} min
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <StatusBadge status={r.status} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
