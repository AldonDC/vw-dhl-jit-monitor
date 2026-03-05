import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Info, Bell, CheckCircle2, Factory, Truck } from 'lucide-react';
import { ALERTS_DATA } from '../data/mockData';
import type { Alert, InventoryProjectionPlan } from '../types';

interface AlertsProps {
  generatedAlerts?: Alert[];
  projectionPlan?: InventoryProjectionPlan | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatHourDecimal(hour: number | null): string {
  if (hour === null || Number.isNaN(hour)) return '--:--';
  const normalized = ((hour % 24) + 24) % 24;
  let h = Math.floor(normalized);
  let m = Math.round((normalized - h) * 60);
  if (m >= 60) {
    h = (h + 1) % 24;
    m = 0;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getHoursFromShiftStart(hour: number | null): number | null {
  if (hour === null || Number.isNaN(hour)) return null;
  return hour >= 6 ? hour - 6 : hour + 18;
}

function getCardClasses(type: Alert['type']): string {
  if (type === 'crit') return 'bg-red-50/50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20';
  if (type === 'warn') return 'bg-yellow-50/50 dark:bg-yellow-500/5 border-yellow-200 dark:border-yellow-500/20';
  return 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20';
}

function getBadgeClasses(type: Alert['type']): string {
  if (type === 'crit') return 'bg-red-500 text-white shadow-red-500/20';
  if (type === 'warn') return 'bg-yellow-500 text-white shadow-yellow-500/20';
  return 'bg-blue-600 text-white shadow-blue-500/20';
}

const AlertCard: React.FC<{ alert: Alert; index: number; scope: 'planta' | 'entrega' }> = ({ alert, index, scope }) => (
  <motion.div
    key={alert.id}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.03 }}
    whileHover={{ y: -8 }}
    className={`p-8 rounded-[2.2rem] border shadow-2xl relative overflow-hidden group transition-all ${getCardClasses(alert.type)}`}
  >
    <div className="absolute top-0 right-0 w-40 h-40 bg-current opacity-[0.03] -mr-16 -mt-16 rounded-full transition-transform group-hover:scale-150 duration-700"></div>

    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl shadow-xl transition-transform group-hover:rotate-12 duration-500 ${getBadgeClasses(alert.type)}`}>
        {alert.type === 'crit' ? <ShieldAlert size={24} /> : alert.type === 'warn' ? <AlertTriangle size={24} /> : <Info size={24} />}
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[10px] font-mono text-slate-400 font-black bg-white/80 dark:bg-black/20 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/5">{alert.time}</span>
        <span className="text-[9px] font-black uppercase text-slate-400 mt-2 tracking-widest leading-none">{scope === 'planta' ? 'PLANT MONITOR' : 'DELIVERY MONITOR'}</span>
      </div>
    </div>

    <h4 className="font-black text-[var(--text-primary)] mb-3 uppercase tracking-tighter italic text-xl leading-tight group-hover:text-blue-600 transition-colors">{alert.title}</h4>
    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-6 font-bold opacity-85 group-hover:opacity-100 transition-opacity">{alert.desc}</p>

    <div className="flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-6">
      <span className="text-[10px] font-black bg-white dark:bg-black/40 px-4 py-2 rounded-xl uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border border-black/5 shadow-sm">{alert.route}</span>
      <button className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest group/btn">
        Resolve <CheckCircle2 size={16} className="group-hover/btn:scale-125 transition-transform" />
      </button>
    </div>
  </motion.div>
);

export const Alerts: React.FC<AlertsProps> = ({ generatedAlerts = [], projectionPlan = null }) => {
  const deliveryAlerts = useMemo(() => [...generatedAlerts, ...ALERTS_DATA], [generatedAlerts]);

  const productionAlerts = useMemo(() => {
    if (!projectionPlan?.projectedDays?.length) return [] as Alert[];

    const bucket: Array<{ severity: number; coverage: number; alert: Alert }> = [];

    for (const row of projectionPlan.rows) {
      for (const day of projectionPlan.projectedDays) {
        const value = row.daily[day];
        if (!value || typeof value.usedThatDay !== 'number' || value.usedThatDay <= 0) continue;

        const piecesPerHour = typeof value.demandPerHour === 'number' && value.demandPerHour > 0
          ? value.demandPerHour
          : value.usedThatDay / 23;
        if (!Number.isFinite(piecesPerHour) || piecesPerHour <= 0) continue;

        const coverageHours = typeof value.coverageHours === 'number'
          ? value.coverageHours
          : (typeof value.stockZoneStart === 'number' ? value.stockZoneStart / piecesPerHour : null);
        if (!Number.isFinite(coverageHours as number)) continue;

        const firstDeliveryHour = typeof value.firstDeliveryHour === 'number' ? value.firstDeliveryHour : null;
        const firstDeliveryFromShiftStart = getHoursFromShiftStart(firstDeliveryHour);
        const firstDeliveryCycle = typeof value.firstDeliveryCycle === 'number' ? value.firstDeliveryCycle : null;
        const roundedCoverage = Number((coverageHours as number).toFixed(2));

        if (roundedCoverage < 2) {
          bucket.push({
            severity: 0,
            coverage: roundedCoverage,
            alert: {
              id: `plant-crit-${row.partZoneId}-${day}`,
              type: 'crit',
              title: `Paro critico de produccion · ${row.np}`,
              desc: `Cobertura estimada ${roundedCoverage} hrs (${piecesPerHour.toFixed(2)} pzas/h). Menor a 2 hrs para ${row.zoneName}.`,
              time: firstDeliveryHour !== null ? formatHourDecimal(firstDeliveryHour) : '--:--',
              route: `${row.np} · ${formatDate(day)}`,
            },
          });
          continue;
        }

        const deliveryWithinWindow = firstDeliveryFromShiftStart !== null
          && firstDeliveryFromShiftStart <= 3
          && firstDeliveryFromShiftStart <= roundedCoverage;
        if (roundedCoverage <= 3 && deliveryWithinWindow) {
          bucket.push({
            severity: 1,
            coverage: roundedCoverage,
            alert: {
              id: `plant-warn-${row.partZoneId}-${day}`,
              type: 'warn',
              title: `Riesgo de produccion · ${row.np}`,
              desc: `Cobertura ${roundedCoverage} hrs (${piecesPerHour.toFixed(2)} pzas/h). Entrega ciclo ${firstDeliveryCycle ?? '--'} a las ${formatHourDecimal(firstDeliveryHour)} (${firstDeliveryFromShiftStart.toFixed(2)} hrs desde inicio de turno) dentro de la ventana de 3 hrs.`,
              time: formatHourDecimal(firstDeliveryHour),
              route: `${row.np} · ${formatDate(day)}`,
            },
          });
        }
      }
    }

    return bucket
      .sort((a, b) => (a.severity - b.severity) || (a.coverage - b.coverage))
      .map((entry) => entry.alert);
  }, [projectionPlan]);

  const criticalCount = useMemo(
    () => [...productionAlerts, ...deliveryAlerts].filter((alert) => alert.type === 'crit').length,
    [productionAlerts, deliveryAlerts]
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-10 pb-10"
    >
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">Centro de alertas</h2>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] mt-3 bg-red-500/5 px-4 py-2 rounded-xl border border-red-500/10 inline-block text-red-600 dark:text-red-400">
            {criticalCount} {criticalCount === 1 ? 'incidente crítico' : 'incidentes críticos'} detectados
          </p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 focus-ring active:scale-95">Limpiar resueltas</button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:opacity-90 transition-all duration-200 focus-ring active:scale-95">Enviar apoyo</button>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
            <Factory size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Producción en planta</h3>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1">
              Alertas por cobertura de stock (demanda diaria / 23 h).
            </p>
          </div>
        </div>

        {productionAlerts.length === 0 ? (
          <div className="glass-card rounded-[2rem] p-8 border border-[var(--border-color)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Sin alertas de produccion con los umbrales actuales (amarillo: ventana 3 hrs con entrega, rojo: menor a 2 hrs).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
            {productionAlerts.map((alert, index) => (
              <AlertCard key={alert.id} alert={alert} index={index} scope="planta" />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
            <Truck size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Entrega en ruta</h3>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1">
              Demoras y eventos operativos de entrega.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
          {deliveryAlerts.map((alert, index) => (
            <AlertCard key={alert.id} alert={alert} index={index} scope="entrega" />
          ))}
        </div>
      </section>

      <div className="glass-card p-12 rounded-[3rem] mt-20 flex flex-col md:flex-row items-center gap-10 border-blue-500/10 transition-shadow duration-300 hover:shadow-lg">
        <div className="w-24 h-24 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 shadow-inner shrink-0">
          <Bell size={40} className="animate-pulse" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Gestión de notificaciones</h3>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-2">Equipos operativos sincronizados con esta torre. Alertas por geocerca en tiempo real.</p>
        </div>
        <button className="px-10 py-5 bg-[#001e50] dark:bg-blue-600 text-white font-black uppercase tracking-widest rounded-[2rem] shadow-2xl shadow-blue-900/40 hover:opacity-90 transition-all duration-200 focus-ring active:scale-95 shrink-0">Configurar alertas</button>
      </div>
    </motion.div>
  );
};
