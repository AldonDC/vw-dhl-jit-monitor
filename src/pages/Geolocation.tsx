import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import { LOCATIONS, VEHICLES, ROUTE_PATHS, TRIPS_T28, ROUTES_DATA } from '../data/mockData';
import type { Trip } from '../data/mockData';
import logoVw from '../assets/logo-vw.png';
import L from 'leaflet';
import { Map as MapIcon, Layers, Navigation, Compass, X, Route, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type RouteInfo = {
  routeId: string;
  routeData: (typeof ROUTES_DATA)[0];
  trips: Trip[];
  path: [number, number][];
};


// --- HELPER COMPONENTS TO CONTROL THE MAP ---
const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    const resetView = () => map.flyTo(center, zoom, { duration: 1.5 });
    (window as any).resetMapView = resetView;
    return null;
};

type RightMapControlsProps = {
  mapType: 'standard' | 'satellite';
  setMapType: (t: 'standard' | 'satellite') => void;
  center: [number, number];
  zoom: number;
};
const RightMapControls = ({ mapType, setMapType, center, zoom }: RightMapControlsProps) => {
    const map = useMap();
    return (
        <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto">
            <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-600 shadow-xl">
                <button type="button" onClick={() => map.zoomIn()} className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white font-black text-lg transition-colors" aria-label="Acercar">+</button>
                <div className="h-px bg-slate-200 dark:bg-slate-600" />
                <button type="button" onClick={() => map.zoomOut()} className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white font-black text-lg transition-colors" aria-label="Alejar">−</button>
            </div>
            <button type="button" onClick={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border-2 transition-all ${mapType === 'satellite' ? 'bg-[#001e50] text-[#ffcc00] border-[#ffcc00]/30' : 'bg-white/95 dark:bg-slate-800/95 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-500'}`} aria-label={mapType === 'satellite' ? 'Mapa estándar' : 'Satélite'}>
                <Layers size={22} />
            </button>
            <button type="button" onClick={() => map.flyTo(center, zoom, { duration: 1.5 })} className="w-12 h-12 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-2 border-slate-200 dark:border-slate-600 shadow-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all" aria-label="Centrar en planta">
                <Compass size={22} />
            </button>
        </div>
    );
};

// --- CUSTOM MARKERS ---
const createVehicleMarker = (status: string, id: string) => {
    const color = status === 'moving' ? '#10b981' : status === 'stopped' ? '#f59e0b' : '#ef4444';
    const pulseClass = status === 'moving' ? 'animate-ping' : '';

    return L.divIcon({
        className: 'custom-vehicle-marker',
        html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-10 h-10 ${color === '#10b981' ? 'bg-emerald-500' : 'bg-transparent'} rounded-full opacity-20 ${pulseClass}"></div>
        <div style="background: ${color};" class="relative w-10 h-10 rounded-xl border-2 border-white shadow-2xl flex items-center justify-center text-white transform hover:scale-110 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3m1 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0m10 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M14 17h1l4-2.5V7h-5v10Z"/></svg>
        </div>
        <div class="absolute top-12 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-lg border border-black/5 shadow-lg">
          <span class="text-[8px] font-black uppercase text-slate-800">${id.split('-')[0]}</span>
        </div>
      </div>
    `,
        iconSize: [40, 60],
        iconAnchor: [20, 30]
    });
};

const vwMarkerIcon = L.divIcon({
    className: 'vw-hq-marker',
    html: `
    <div class="relative group">
      <div class="absolute -inset-4 bg-blue-600/20 blur-xl rounded-full animate-pulse"></div>
      <div class="relative bg-white w-14 h-14 rounded-2xl border-4 border-white shadow-[0_15px_35px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden p-2">
        <img src="${logoVw}" alt="VW" class="w-full h-full object-contain" />
      </div>
    </div>
  `,
    iconSize: [56, 56],
    iconAnchor: [28, 28]
});


// --- SIMPLE ROUTE FOLLOWING (no external routing API). ---
// We move the marker along a polyline by "progress" (0..1).
const haversineMeters = (a: [number, number], b: [number, number]) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2);
  return 2 * R * Math.asin(Math.sqrt(x));
};

const polylineLengths = (pts: [number, number][]) => {
  const seg = [] as number[];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = haversineMeters(pts[i], pts[i + 1]);
    seg.push(d);
    total += d;
  }
  return { seg, total };
};

const pointAtProgress = (pts: [number, number][], progress01: number) => {
  if (pts.length === 0) return [0, 0] as [number, number];
  if (pts.length === 1) return pts[0];

  const p = Math.min(1, Math.max(0, progress01));
  const { seg, total } = polylineLengths(pts);
  const target = total * p;

  let acc = 0;
  for (let i = 0; i < seg.length; i++) {
    const next = acc + seg[i];
    if (target <= next) {
      const local = seg[i] === 0 ? 0 : (target - acc) / seg[i];
      const a = pts[i];
      const b = pts[i + 1];
      return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local] as [number, number];
    }
    acc = next;
  }
  return pts[pts.length - 1];
};

const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  // handle invalid
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
};

const durationMinutes = (depart: string, arrive: string) => {
  const d = hhmmToMinutes(depart);
  const a = hhmmToMinutes(arrive);
  // handle overnight (e.g., 22:50 -> 00:00)
  return a >= d ? a - d : (24 * 60 - d) + a;
};

// Rutas con geometría + datos para match y popup
const ROUTES_WITH_INFO: RouteInfo[] = Object.keys(ROUTE_PATHS).map((routeId) => {
  const path = ROUTE_PATHS[routeId] ?? [];
  const routeData = ROUTES_DATA.find((r) => r.id === routeId) ?? {
    id: routeId,
    prov: '-',
    origin: '-',
    target: '-',
    status: 'ok' as const,
    window: '-',
    real: '-',
    delta: 0,
    turno: 1,
  };
  const trips = routeId === 'T28' ? TRIPS_T28 : [];
  return { routeId, routeData, trips, path };
}).filter((r) => r.path.length > 0);

export const Geolocation: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
    const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
    const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
    const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
    const isDark = theme === 'dark';

    const openRouteInfo = useCallback((info: RouteInfo) => setSelectedRoute(info), []);
    const closeRouteInfo = useCallback(() => setSelectedRoute(null), []);

    // Simulation controls
    // Real route is ~40 min; we compress to 10 min => 4x speed.
    const SIM_SPEED = 4; // 1 = real time, 4 = 4x faster

    // Start the simulation at 06:00 (PDF first depart). We advance a simulated minute clock.
    const [simMinutes, setSimMinutes] = useState(() => hhmmToMinutes('06:00'));

    useEffect(() => {
      const t = setInterval(() => {
        // Each real second advances SIM_SPEED seconds; convert to minutes
        setSimMinutes((prev) => {
          const next = prev + (SIM_SPEED / 60); // minutes per second
          return next >= 24 * 60 ? next - 24 * 60 : next;
        });
      }, 1000);
      return () => clearInterval(t);
    }, []);

    const t28Path = useMemo(() => ROUTE_PATHS.T28 ?? [], []);

    // Pick the active trip based on the simulated time; if none active, keep last known position.
    const activeTrip = useMemo(() => {
      // Expand each trip into a time window in minutes, considering overnight.
      const now = simMinutes;
      for (const trip of TRIPS_T28) {
        const start = hhmmToMinutes(trip.depart);
        const dur = durationMinutes(trip.depart, trip.arrive);
        const end = (start + dur) % (24 * 60);

        const isOvernight = end < start;
        const inWindow = isOvernight
          ? (now >= start || now <= end)
          : (now >= start && now <= end);

        if (inWindow) {
          // compute progress within the window
          const elapsed = isOvernight
            ? (now >= start ? now - start : (24 * 60 - start) + now)
            : (now - start);

          const progress = dur === 0 ? 1 : Math.min(1, Math.max(0, elapsed / dur));
          return { trip, progress };
        }
      }
      return null;
    }, [simMinutes]);

    const [vehiclePos, setVehiclePos] = useState<[number, number]>(VEHICLES[0]?.pos ?? LOCATIONS.AKSYS);

    useEffect(() => {
      if (!activeTrip) return;
      setVehiclePos(pointAtProgress(t28Path, activeTrip.progress));
    }, [activeTrip, t28Path]);

    const simClockLabel = useMemo(() => {
      const total = Math.floor(simMinutes);
      const hh = String(Math.floor(total / 60)).padStart(2, '0');
      const mm = String(total % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    }, [simMinutes]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="geolocation-page h-[80vh] w-full rounded-[2.5rem] overflow-hidden relative bg-slate-200 dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700"
        >
            {/* Marco tipo HUD: franja superior azul VW + sombra interna */}
            <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none z-[998]" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,30,80,0.08), inset 0 2px 4px rgba(0,0,0,0.04)' }} />
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[2.5rem] bg-gradient-to-r from-[#001e50] via-[#2563eb] to-[#001e50] pointer-events-none z-[999]" />
            <style>{`
              .geolocation-page .leaflet-interactive { cursor: pointer; }
              .geolocation-page .leaflet-control-attribution { font-size: 9px; opacity: 0.7; }
            `}</style>
            <MapContainer
                center={LOCATIONS.PLANTA_VW}
                zoom={14}
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
            >
                {/* Actual Dynamic Tile Layer */}
                {mapType === 'standard' ? (
                    <TileLayer
                        url={isDark
                            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        }
                    />
                ) : (
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                )}

                <MapController center={LOCATIONS.PLANTA_VW} zoom={15} />
                <RightMapControls mapType={mapType} setMapType={setMapType} center={LOCATIONS.PLANTA_VW} zoom={15} />

                {ROUTES_WITH_INFO.map((info) => (
                  <Polyline
                    key={info.routeId}
                    positions={info.path}
                    pathOptions={{
                      color: selectedRoute?.routeId === info.routeId ? '#2563eb' : '#3b82f6',
                      weight: hoveredRouteId === info.routeId ? 10 : 6,
                      opacity: hoveredRouteId === info.routeId ? 0.9 : 0.6,
                      dashArray: '10, 10',
                    }}
                    eventHandlers={{
                      click: () => openRouteInfo(info),
                      mouseover: () => setHoveredRouteId(info.routeId),
                      mouseout: () => setHoveredRouteId(null),
                    }}
                  />
                ))}
                <Circle center={LOCATIONS.PLANTA_VW} radius={1000} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05 }} />

                <Marker position={LOCATIONS.PLANTA_VW} icon={vwMarkerIcon}>
                    <Popup className="premium-popup-v2">
                        <div className="p-2"><h4 className="font-black text-lg text-[#001e50] uppercase italic">VW México HQ</h4><p className="text-[10px] font-bold text-slate-500">Logistics Receiving Unit</p></div>
                    </Popup>
                </Marker>

                {VEHICLES.map((v, i) => (
                    <Marker key={i} position={vehiclePos} icon={createVehicleMarker(v.status, v.id)}>
                        <Popup className="vehicle-popup-pro">
                            <div className="min-w-[180px] p-2">
                                <span className="font-black text-blue-600 block mb-1 uppercase tracking-widest text-[9px]">Live Tracker</span>
                                <span className="font-black text-lg uppercase">{v.id}</span>
                                <div className="mt-3 space-y-2 border-t pt-2 border-slate-100">
                                    <div className="flex justify-between text-[10px] font-black uppercase"><span>Status</span><span className={v.status === 'moving' ? 'text-emerald-500' : 'text-red-500'}>{v.status}</span></div>
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                      <span>Sim Clock</span>
                                      <span className="text-blue-600">{simClockLabel}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                      <span>Trip</span>
                                      <span className="text-slate-600">{activeTrip ? activeTrip.trip.id : 'IDLE'}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black uppercase">
                                      <span>Zone</span>
                                      <span className="text-slate-600">{activeTrip ? activeTrip.trip.zone : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* --- FUNCTIONAL UI OVERLAYS --- */}

            {/* Panel izquierdo: Flota + Reloj sim + Leyenda */}
            <div className="absolute top-6 left-6 z-[1000] pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.35 }}
                    className="w-72 pointer-events-auto rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-600 shadow-xl overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-[#001e50] dark:bg-blue-500 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Flota · Live</span>
                        </div>
                        <span className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 tabular-nums">{simClockLabel}</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {VEHICLES.map((v, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${v.status === 'moving' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500'}`} />
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{v.id}</p>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Ruta {v.route} · {activeTrip ? activeTrip.trip.id : 'IDLE'}</p>
                                    </div>
                                </div>
                                <Navigation size={16} className="text-slate-300 dark:text-slate-500 shrink-0" />
                            </div>
                        ))}
                    </div>
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/50">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Leyenda</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-bold text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> Ruta</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-white border border-slate-300" /> Planta VW</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500" /> Unidad</span>
                        </div>
                    </div>
                </motion.div>
            </div>


            {/* Barra inferior */}
            <div className="absolute bottom-6 left-6 right-6 z-[1000] flex justify-between items-center pointer-events-none gap-4">
                <div className="pointer-events-auto flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-600 shadow-xl">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">En línea</span>
                    </div>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600" />
                    <div className="flex items-center gap-2 text-[#001e50] dark:text-blue-400">
                        <MapIcon size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Sector {activeTrip ? activeTrip.trip.zone : '—'}</span>
                    </div>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600" />
                    <span className="text-[10px] font-mono font-black text-slate-600 dark:text-slate-300 tabular-nums">Sim {simClockLabel}</span>
                </div>
                <div className="pointer-events-auto px-5 py-3 rounded-2xl bg-[#001e50] dark:bg-[#001e50] border border-[#001e50]/80 shadow-xl">
                    <span className="text-[10px] font-black italic uppercase tracking-tight text-[#ffcc00]">DHL · Logistics Command</span>
                </div>
            </div>

            {/* Mini ventana: info de la ruta al hacer clic en el polyline */}
            <AnimatePresence>
              {selectedRoute && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-24 left-8 z-[1001] w-[340px] max-h-[70vh] pointer-events-auto"
                >
                  <div className="glass-card rounded-2xl border-4 border-white shadow-2xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-600 bg-[#001e50] text-white">
                      <div className="flex items-center gap-2">
                        <Route size={18} />
                        <span className="font-black uppercase tracking-tight text-sm">Ruta {selectedRoute.routeId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={closeRouteInfo}
                        className="p-1.5 rounded-xl hover:bg-white/20 transition-colors"
                        aria-label="Cerrar"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-4 space-y-4 max-h-[55vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
                        <div className="col-span-2 text-slate-500 tracking-widest">Proveedor / Origen → Destino</div>
                        <div className="col-span-2 text-slate-800 dark:text-slate-200">{selectedRoute.routeData.prov}</div>
                        <div><span className="text-slate-500">Origen</span><br /><span className="text-slate-800 dark:text-slate-100">{selectedRoute.routeData.origin}</span></div>
                        <div><span className="text-slate-500">Destino</span><br /><span className="text-slate-800 dark:text-slate-100">{selectedRoute.routeData.target}</span></div>
                        <div><span className="text-slate-500">Ventana</span><br /><span className="text-blue-600 dark:text-blue-400">{selectedRoute.routeData.window}</span></div>
                        <div><span className="text-slate-500">Real</span><br /><span className={selectedRoute.routeData.delta > 0 ? 'text-amber-600' : 'text-emerald-600'}>{selectedRoute.routeData.real}</span></div>
                        <div><span className="text-slate-500">Delta</span><br /><span className={selectedRoute.routeData.delta > 0 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}>{selectedRoute.routeData.delta} min</span></div>
                        <div><span className="text-slate-500">Estado</span><br /><span className={selectedRoute.routeData.status === 'ok' ? 'text-emerald-600' : selectedRoute.routeData.status === 'risk' ? 'text-amber-600' : 'text-red-600'}>{selectedRoute.routeData.status}</span></div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                          <Clock size={12} />
                          Ciclos / Viajes
                        </div>
                        <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {selectedRoute.trips.map((t) => (
                            <li key={t.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[10px] font-bold">
                              <span className="text-slate-700 dark:text-slate-200">{t.id}</span>
                              <span className="text-slate-500">{t.depart} → {t.arrive}</span>
                              <span className="text-blue-600 dark:text-blue-400 truncate max-w-[100px]" title={t.zone}>{t.zone}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Haz clic en la ruta en el mapa para ver esta info</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </motion.div>
    );
};
