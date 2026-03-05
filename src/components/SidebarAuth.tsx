/**
 * Bloque de sesión en el sidebar: solo muestra usuario + cerrar sesión.
 * El login está en la pantalla inicial (Login.tsx).
 */

import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarAuthProps {
  collapsed: boolean;
}

export const SidebarAuth: React.FC<SidebarAuthProps> = ({ collapsed }) => {
  const { user, isConfigured, signOut, loading } = useAuth();

  if (!isConfigured || loading || !user) return null;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-2 items-center py-2">
        <button
          type="button"
          onClick={() => signOut()}
          className="w-12 h-12 rounded-2xl bg-white/5 border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:border-red-500/30 transition-all"
          title="Cerrar sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl glass-card border border-[var(--border-color)] bg-black/[0.02] dark:bg-white/[0.02]">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Sesión</span>
      <p className="text-sm text-[var(--text-primary)] truncate" title={user.email}>{user.email}</p>
      <button
        type="button"
        onClick={() => signOut()}
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </div>
  );
};
