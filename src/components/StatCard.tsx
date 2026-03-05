import React from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'blue' | 'cyan' | 'yellow' | 'red';
    /** Breve explicación para que cualquier persona entienda el indicador (opcional). */
    hint?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, hint }) => {
    const colors = {
        blue: 'text-blue-600 dark:text-blue-400 border-blue-500/10',
        cyan: 'text-cyan-600 dark:text-cyan-400 border-cyan-500/10',
        yellow: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/10',
        red: 'text-red-600 dark:text-red-400 border-red-500/10'
    };

    const iconColors = {
        blue: 'text-blue-600 dark:text-blue-400',
        cyan: 'text-cyan-600 dark:text-cyan-400',
        yellow: 'text-yellow-600 dark:text-yellow-400',
        red: 'text-red-600 dark:text-red-400',
    };
    return (
        <div className={`p-6 rounded-[2rem] flex flex-col justify-between hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 cursor-default glass-card relative overflow-hidden border group ${colors[color]}`} title={hint}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.04] -mr-8 -mt-8 rounded-full transition-transform duration-300 group-hover:scale-110"></div>
            <div className="flex justify-between items-center relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 transition-colors">{label}</span>
                <div className={`scale-90 opacity-70 group-hover:opacity-100 transition-all duration-200 ${iconColors[color]}`}>{icon}</div>
            </div>
            <span className="text-4xl font-black tracking-tighter mt-6 text-[var(--text-primary)] relative z-10">{value}</span>
            {hint && <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-2 opacity-80 line-clamp-2">{hint}</p>}
        </div>
    );
};
