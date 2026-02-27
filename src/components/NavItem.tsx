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
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${active
                ? 'bg-[var(--accent-color)] text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
            }`}
    >
        <div className={`flex-shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>
        {!collapsed && (
            <>
                <span className="flex-1 text-left text-xs font-black uppercase tracking-widest">{label}</span>
                {badge && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-500/30">
                        {badge}
                    </span>
                )}
            </>
        )}
        {active && (
            <div className="absolute left-0 w-1 h-6 bg-white rounded-full ml-1"></div>
        )}
    </button>
);
