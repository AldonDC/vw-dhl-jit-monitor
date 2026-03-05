import React from 'react';

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    collapsed: boolean;
    onClick: () => void;
    badge?: number;
}

export const NavItem: React.FC<NavItemProps> = ({ icon, label, active, collapsed, onClick, badge }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative focus-ring active:scale-[0.98] ${active
                ? 'bg-[var(--accent-color)] text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
        aria-current={active ? 'page' : undefined}
        aria-label={badge != null && badge > 0 ? `${label}, ${badge} pendiente${badge !== 1 ? 's' : ''}` : label}
    >
        <div className={`flex-shrink-0 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
            {icon}
        </div>
        {!collapsed && (
            <>
                <span className="flex-1 text-left text-xs font-black uppercase tracking-widest">{label}</span>
                {badge != null && badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-500/30" aria-hidden="true">
                        {badge}
                    </span>
                )}
            </>
        )}
        {active && (
            <div className="absolute left-0 w-1 h-6 bg-white rounded-full ml-1" aria-hidden="true"></div>
        )}
    </button>
);
