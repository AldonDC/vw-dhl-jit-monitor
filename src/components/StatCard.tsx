import React from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'blue' | 'cyan' | 'yellow' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
    const colors = {
        blue: 'text-blue-600 dark:text-blue-400 border-blue-500/10',
        cyan: 'text-cyan-600 dark:text-cyan-400 border-cyan-500/10',
        yellow: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/10',
        red: 'text-red-600 dark:text-red-400 border-red-500/10'
    };

    return (
        <div className={`p-6 rounded-[2rem] flex flex-col justify-between hover:scale-[1.05] hover:-translate-y-1 transition-all cursor-default glass-card relative overflow-hidden boarder ${colors[color]}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.03] -mr-8 -mt-8 rounded-full transition-all duration-500"></div>
            <div className="flex justify-between items-center relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 transition-colors">{label}</span>
                <div className="text-slate-400 group-hover:text-current transition-colors scale-90">{icon}</div>
            </div>
            <span className="text-4xl font-black tracking-tighter mt-6 text-[var(--text-primary)] relative z-10">{value}</span>
        </div>
    );
};
