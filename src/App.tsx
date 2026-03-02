import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Route as RouteIcon, MapPin, Bell, Sun, Moon, Menu, Database } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { ALERTS_DATA } from './data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import logoVw from './assets/logo-vw.png';
import type { Alert, InventoryProjectionPlan, RouteDelayAssignment } from './types';

// Component Imports
import { NavItem } from './components/NavItem';
import { ExcelUpload } from './components/ExcelUpload';

// Page Imports
import { Dashboard } from './pages/Dashboard';
import { RouteCycles } from './pages/RouteCycles';
import { Geolocation } from './pages/Geolocation';
import { Alerts } from './pages/Alerts';
import { Simulation } from './pages/Simulation';
import { DriverPortal } from './pages/DriverPortal';

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activePage, setActivePage] = useState('torre');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [delayAssignments, setDelayAssignments] = useState<Record<string, RouteDelayAssignment>>({});
  const [inventoryProjection, setInventoryProjection] = useState<InventoryProjectionPlan | null>(null);
  const [visibleDelayKeys, setVisibleDelayKeys] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setVisibleDelayKeys((prev) => prev.filter((key) => key in delayAssignments));
  }, [delayAssignments]);

  const getTurno = () => {
    const hr = currentTime.getHours();
    if (hr >= 6 && hr < 15) return { label: 'TURNO 1', hours: '06:00 - 15:00' };
    if (hr >= 15 && hr < 23 || (hr === 23 && currentTime.getMinutes() < 30)) return { label: 'TURNO 2', hours: '15:00 - 23:30' };
    return { label: 'TURNO 3', hours: '23:30 - 06:00' };
  };

  const turno = getTurno();
  const pageTitleByKey: Record<string, string> = {
    torre: 'Central Intelligence',
    ruta: 'Route Analytics',
    mapa: 'Global Geolocation',
    alertas: 'Extreme Alerts',
    simulacion: 'Simulation Matrix',
    dhl: 'Driver Validation',
  };

  const generatedDelayAlerts: Alert[] = Object.values(delayAssignments)
    .sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1))
    .map((delay) => ({
      id: `delay-${delay.serviceDate ?? 'base'}-${delay.rowId}`,
      type: delay.minutes >= 40 ? 'crit' : delay.minutes >= 20 ? 'warn' : 'info',
      title: `${delay.eventLabel?.trim() ? delay.eventLabel : 'Demora pendiente'} (+${delay.minutes} min)`,
      desc: `Ciclo ${delay.cycleNumber} en ${delay.routeCode}${delay.serviceDate ? ` (${new Date(delay.serviceDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })})` : ''}: afectacion en tramo salida proveedor -> llegada VW. ${delay.eventLabel?.trim() ? '' : 'Motivo del conductor: pendiente.'}`,
      time: new Date(delay.appliedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }),
      route: `${delay.routeCode}-C${String(delay.cycleNumber).padStart(2, '0')}${delay.serviceDate ? `-${new Date(delay.serviceDate).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}` : ''}`,
    }));

  const alertsBadgeCount = ALERTS_DATA.length + generatedDelayAlerts.length;

  return (
    <div className={`flex h-screen w-full font-sans selection:bg-blue-500/30 overflow-hidden relative ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Background HUD Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 bg-[var(--bg-main)] transition-colors duration-500">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(var(--text-secondary)_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.05]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[150px] rounded-full opacity-20"></div>
      </div>

      {/* Sidebar */}
      <aside
        className={`relative z-50 flex flex-col shrink-0 transition-all duration-500 ease-in-out premium-sidebar ${isSidebarOpen ? 'w-80' : 'w-24'}`}
      >
        <div className={`h-28 flex items-center ${isSidebarOpen ? 'px-10' : 'justify-center'} border-b border-[var(--border-color)] shrink-0`}>
          <div className="flex items-center gap-5 overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-white flex-shrink-0 flex items-center justify-center shadow-2xl shadow-blue-900/30 border border-white/10 overflow-hidden p-2">
              <img src={logoVw} alt="VW" className="w-full h-full object-contain" />
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
                <span className="font-black text-xl tracking-tighter uppercase italic leading-tight text-[var(--text-primary)]">Logistics Hub</span>
                <span className="text-[10px] text-blue-600 font-black uppercase tracking-[0.4em] mt-1">Operational Tower</span>
              </motion.div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-12 px-6 space-y-3 overflow-y-auto custom-scrollbar">
          <NavItem
            icon={<LayoutDashboard size={24} />}
            label="Dashboard"
            active={activePage === 'torre'}
            collapsed={!isSidebarOpen}
            onClick={() => setActivePage('torre')}
          />
          <NavItem
            icon={<RouteIcon size={24} />}
            label="Route Cycles"
            active={activePage === 'ruta'}
            collapsed={!isSidebarOpen}
            onClick={() => setActivePage('ruta')}
          />
          <NavItem
            icon={<MapPin size={24} />}
            label="Geolocation"
            active={activePage === 'mapa'}
            collapsed={!isSidebarOpen}
            onClick={() => setActivePage('mapa')}
          />
          <NavItem
            icon={<Bell size={24} />}
            label="Alert Center"
            active={activePage === 'alertas'}
            collapsed={!isSidebarOpen}
            onClick={() => setActivePage('alertas')}
            badge={alertsBadgeCount}
          />
          <NavItem
            icon={<Database size={24} />}
            label="Simulation"
            active={activePage === 'simulacion'}
            collapsed={!isSidebarOpen}
            onClick={() => setActivePage('simulacion')}
          />
        </nav>

        <div className={`${isSidebarOpen ? 'p-8' : 'p-4'} border-t border-[var(--border-color)] space-y-6 shrink-0 bg-black/[0.01] dark:bg-white/[0.01]`}>
          {isSidebarOpen && (
            <div className="flex items-center gap-4 p-5 rounded-3xl glass-card border border-[var(--border-color)] shadow-xl group cursor-pointer hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden p-1.5">
                <img src={logoVw} alt="VW" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-black truncate uppercase tracking-tight text-[var(--text-primary)]">Admin DHL</span>
                <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mt-0.5">Control Supervisor</span>
              </div>
            </div>
          )}
          <div className={`flex ${isSidebarOpen ? 'flex-row gap-4' : 'flex-col gap-2'} justify-center items-center`}>
            <button
              onClick={() => setActivePage('dhl')}
              className={`${isSidebarOpen ? 'flex-1' : 'w-12'} text-center py-2.5 bg-yellow-400 text-black text-[10px] font-black rounded-xl uppercase shadow-lg shadow-yellow-400/20 active:scale-95 transition-transform ${activePage === 'dhl' ? 'ring-2 ring-offset-2 ring-yellow-300 ring-offset-transparent' : ''}`}
            >
              DHL
            </button>
            <span className={`${isSidebarOpen ? 'flex-1' : 'w-12 h-9'} flex items-center justify-center py-2.5 bg-white text-[#001e50] text-[10px] font-black rounded-xl uppercase shadow-lg shadow-black/10 active:scale-95 transition-transform overflow-hidden`}>
              <img src={logoVw} alt="VW" className="h-4 object-contain" />
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Topbar */}
        <header className="h-28 px-14 flex items-center justify-between shrink-0 relative bg-[var(--bg-surface)]/40 backdrop-blur-2xl border-b border-[var(--border-color)]">
          <div className="flex items-center gap-10">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-14 h-14 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] group shadow-sm bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5"
            >
              <Menu size={26} className="group-hover:rotate-180 transition-all duration-500" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-500 tracking-[0.5em] uppercase leading-none">Global Network Monitor</span>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase leading-none">PUEBLA STATION</span>
              </div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-[var(--text-primary)] mt-2">
                {pageTitleByKey[activePage] ?? 'Central Intelligence'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-12">
            <div className="hidden xl:flex items-center gap-5 bg-emerald-500/5 px-6 py-3 rounded-2xl border border-emerald-500/10 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)] relative z-10"></div>
              <div className="flex flex-col relative z-10">
                <span className="text-[10px] font-black text-emerald-600 tracking-widest uppercase">{turno.label}</span>
                <span className="text-[11px] text-[var(--text-secondary)] font-mono font-black mt-1 leading-none">{turno.hours}</span>
              </div>
            </div>
            <div className="hidden lg:block">
              <ExcelUpload />
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="block text-4xl font-black font-mono tracking-tighter text-[var(--text-primary)] italic leading-none">{currentTime.toLocaleTimeString('es-MX', { hour12: false })}</span>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.4em] block">
                  {currentTime.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="w-16 h-16 flex items-center justify-center glass-card hover:scale-110 active:scale-90 transition-all shadow-2xl group rounded-[1.25rem] relative overflow-hidden bg-white/50 dark:bg-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <AnimatePresence mode="wait">
                {theme === 'dark'
                  ? <motion.div key="sun" initial={{ y: 20, rotate: -45, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -20, rotate: 45, opacity: 0 }} transition={{ duration: 0.3 }}><Sun size={26} className="text-yellow-400 relative z-10" fill="currentColor" /></motion.div>
                  : <motion.div key="moon" initial={{ y: 20, rotate: -45, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -20, rotate: 45, opacity: 0 }} transition={{ duration: 0.3 }}><Moon size={26} className="text-[#001e50] relative z-10" fill="currentColor" /></motion.div>
                }
              </AnimatePresence>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-14 custom-scrollbar relative">
          <div className={activePage === 'ruta' ? 'block' : 'hidden'}>
            <RouteCycles
              delayAssignments={delayAssignments}
              projectionPlan={inventoryProjection}
              onProjectionPlanChange={setInventoryProjection}
              onOpenDriverPage={() => setActivePage('dhl')}
              onRevealDelay={(key) => {
                setVisibleDelayKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
              }}
            />
          </div>

          {activePage !== 'ruta' && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {activePage === 'torre' && <Dashboard theme={theme} />}
                {activePage === 'mapa' && <Geolocation theme={theme} />}
                {activePage === 'alertas' && (
                  <Alerts
                    generatedAlerts={generatedDelayAlerts}
                    projectionPlan={inventoryProjection}
                  />
                )}
                {activePage === 'simulacion' && (
                  <Simulation
                    delayAssignments={delayAssignments}
                    onDelayAssignmentsChange={setDelayAssignments}
                    projectionPlan={inventoryProjection}
                    onProjectionPlanChange={setInventoryProjection}
                  />
                )}
                {activePage === 'dhl' && (
                  <DriverPortal
                    delayAssignments={delayAssignments}
                    onDelayAssignmentsChange={setDelayAssignments}
                    projectionPlan={inventoryProjection}
                    visibleDelayKeys={visibleDelayKeys}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
