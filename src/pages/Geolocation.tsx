import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import { LOCATIONS, VEHICLES, ROUTE_PATHS, TRIPS_T28 } from '../data/mockData';
import logoVw from '../assets/logo-vw.png';
import L from 'leaflet';
import { Map as MapIcon, Layers, Navigation, Compass } from 'lucide-react';
import 'leaflet/dist/leaflet.css';


// --- HELPER COMPONENT TO CONTROL THE MAP ---
const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();

    // Custom function to reset view
    const resetView = () => {
        map.flyTo(center, zoom, { duration: 1.5 });
    };

    // Assign the reset function to a global window for the custom button to call it
    // (In a real app, we'd use a context or ref, but for this mockup this is fast and effective)
    (window as any).resetMapView = resetView;

    return null;
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

export const Geolocation: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
    const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
    const isDark = theme === 'dark';

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
            className="h-[80vh] w-full rounded-[3.5rem] overflow-hidden border-8 border-white dark:border-slate-800 shadow-[0_40px_100px_rgba(0,0,0,0.2)] relative bg-slate-100"
        >
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

                <Polyline positions={t28Path} pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.6, dashArray: '10, 10' }} />
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

            {/* HUD Panel Left */}
            <div className="absolute top-8 left-8 z-[1000] pointer-events-none">
                <div className="glass-card p-6 rounded-[2rem] w-80 pointer-events-auto border-4 border-white shadow-2xl">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/5">
                        <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Fleet Control</h3>
                    </div>
                    <div className="space-y-5">
                        {VEHICLES.map((v, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${v.status === 'moving' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase leading-none">{v.id}</span>
                                        <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Route {v.route}</span>
                                    </div>
                                </div>
                                <Navigation size={14} className="text-slate-300" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Buttons: FUNCTIONAL */}
            <div className="absolute top-8 right-8 z-[1000] flex flex-col gap-3">
                {/* Toggle Satelite */}
                <button
                    onClick={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-2xl border-2 border-white ${mapType === 'satellite' ? 'bg-blue-600 text-white' : 'glass-card text-slate-600'}`}
                >
                    <Layers size={22} className={mapType === 'satellite' ? 'animate-pulse' : ''} />
                </button>

                {/* Reset View (Compass) */}
                <button
                    onClick={() => (window as any).resetMapView?.()}
                    className="w-14 h-14 glass-card rounded-2xl flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all shadow-2xl border-2 border-white active:scale-90"
                >
                    <Compass size={22} />
                </button>
            </div>

            <div className="absolute bottom-10 left-10 right-10 z-[1000] flex justify-between items-center pointer-events-none">
                <div className="glass-card px-8 py-4 rounded-full border-4 border-white shadow-2xl pointer-events-auto flex items-center gap-6">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">24 Nodes Active</span></div>
                    <div className="w-px h-4 bg-slate-200"></div>
                    <div className="flex items-center gap-3 text-blue-600">
                      <MapIcon size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Sector: {activeTrip ? activeTrip.trip.zone : '—'}
                      </span>
                    </div>
                </div>
                <div className="glass-card px-6 py-4 rounded-2xl border-4 border-white shadow-2xl pointer-events-auto bg-[#001e50] text-[#ffcc00] font-black italic text-xs uppercase tracking-tighter">DHL LOGISTICS COMMAND</div>
            </div>
        </motion.div>
    );
};
