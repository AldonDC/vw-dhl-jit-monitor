import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageCircle, FileText, Send, Loader2, CheckCircle, Info } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function parseJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.trimStart().startsWith('<')) {
      throw new Error('El servidor no respondió con JSON (posiblemente el backend no está corriendo). Abre otra terminal, ejecuta: cd server y luego npm run dev');
    }
    throw new Error(`Error del servidor: ${res.status}. ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface SummaryForReport {
  coberturaPct: number;
  coveredLatest: number;
  countedLatest: number;
  shortageLatest: number;
  delayByType: { label: string; count: number; minutes: number }[];
  comparativa: {
    proveedor: { nombre: string; total: number; aTiempo: number; pct: number };
    almacenista: { nombre: string; total: number; aTiempo: number; pct: number };
  };
  latestDay: string | null;
}

interface EnviarResponse {
  ok: boolean;
  email?: { enviado: boolean; demo?: boolean; mensaje?: string; contenidoTexto?: string; rutaArchivo?: string };
  whatsapp?: { enviado: boolean; demo?: boolean; mensaje?: string; mensajeWhatsApp?: string };
  resumenAI?: string | null;
  contenidoTexto?: string;
}

export const Reportes: React.FC = () => {
  const [emails, setEmails] = useState('');
  const [phones, setPhones] = useState('');
  const [incluirResumenAI, setIncluirResumenAI] = useState(true);
  const [summary, setSummary] = useState<SummaryForReport | null>(null);
  const [preview, setPreview] = useState<EnviarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [simRes, routesRes] = await Promise.all([
        fetch(`${API_BASE}/api/simulation?take=300`),
        fetch(`${API_BASE}/api/simulation/routes`),
      ]);
      if (!simRes.ok || !routesRes.ok) throw new Error('Error al cargar datos del servidor');
      const sim = (await parseJsonResponse(simRes)) as { days: string[]; rows: unknown[]; summary: { totalPartZones: number } };
      const routes = (await parseJsonResponse(routesRes)) as { serviceDate: string | null; rows: { routeCode: string; cycleNumber: number; supplierName: string; logisticZoneLabel: string; vwArriveAt: string }[] };
      const days = sim.days ?? [];
      const rows = sim.rows ?? [];
      const latestDay = days.length ? days[days.length - 1] : null;

      let coveredLatest = 0;
      let countedLatest = 0;
      let shortageLatest = 0;
      let totalUsed = 0;
      for (const row of rows as { daily: Record<string, { saldo?: number; usedThatDay?: number }> }[]) {
        if (!latestDay || !row.daily?.[latestDay]) continue;
        const v = row.daily[latestDay];
        countedLatest += 1;
        if (typeof v.saldo === 'number' && v.saldo >= 0) coveredLatest += 1;
        if (typeof v.saldo === 'number' && v.saldo < 0) shortageLatest += Math.abs(v.saldo);
        if (typeof v.usedThatDay === 'number') totalUsed += v.usedThatDay;
      }
      const coberturaPct = countedLatest > 0 ? Math.round((coveredLatest / countedLatest) * 1000) / 10 : 0;

      const routeRows = routes.rows ?? [];
      const provTotal = routeRows.length;
      const zoneTotal = routeRows.length;
      const provOk = provTotal;
      const zoneOk = zoneTotal;

      setSummary({
        coberturaPct,
        coveredLatest,
        countedLatest: countedLatest || sim.summary?.totalPartZones || 0,
        shortageLatest,
        delayByType: [],
        comparativa: {
          proveedor: { nombre: 'Proveedor', total: provTotal, aTiempo: provOk, pct: provTotal ? Math.round((provOk / provTotal) * 100) : 0 },
          almacenista: { nombre: 'Almacenista / Planta', total: zoneTotal, aTiempo: zoneOk, pct: zoneTotal ? Math.round((zoneOk / zoneTotal) * 100) : 0 },
        },
        latestDay,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos. ¿Está corriendo el backend? (cd server y npm run dev)');
      setSummary(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleGenerarPreview = async () => {
    if (!summary) return;
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`${API_BASE}/api/reportes/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          emails: [],
          phones: [],
          incluirResumenAI,
        }),
      });
      const data = (await parseJsonResponse(res)) as EnviarResponse;
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Error al generar');
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar. ¿Está corriendo el backend?');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = async () => {
    if (!summary) return;
    const emailList = emails.split(/[\s,;]+/).filter(Boolean);
    const phoneList = phones.split(/[\s,;]+/).filter(Boolean);
    if (!emailList.length && !phoneList.length) {
      setError('Indica al menos un correo o un número para WhatsApp.');
      return;
    }
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/reportes/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          emails: emailList,
          phones: phoneList,
          incluirResumenAI,
        }),
      });
      const data = (await parseJsonResponse(res)) as EnviarResponse;
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Error al enviar');
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar. ¿Está corriendo el backend?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-full rounded-3xl bg-sky-50 p-8 -m-8 space-y-8 pb-10"
    >
      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Reportes y envío</h2>
        <p className="text-slate-700 text-base font-medium max-w-2xl leading-relaxed">
          Genera el reporte del día con resumen en lenguaje natural (IA) y envíalo por correo o WhatsApp. Configura SMTP y Twilio en el servidor para envío real.
        </p>
      </div>

      {loadingData && (
        <div className="flex items-center gap-3 text-slate-700 text-base">
          <Loader2 size={22} className="animate-spin shrink-0" />
          <span>Cargando datos del dashboard…</span>
        </div>
      )}

      {error && (
        <div className="p-5 rounded-2xl bg-red-100 border-2 border-red-300 text-red-900 text-base font-medium flex items-start gap-3">
          <Info size={22} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {summary && !loadingData && (
        <>
          <div className="rounded-[2rem] p-8 max-w-2xl border-2 border-sky-200 bg-white shadow-md">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
                <Mail size={20} />
              </span>
              Correo y WhatsApp
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Correos (separados por coma)</label>
                <input
                  type="text"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="ejemplo@empresa.com, gerencia@dhl.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 text-base placeholder:text-slate-500 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">WhatsApp (números con código país, separados por coma)</label>
                <input
                  type="text"
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  placeholder="5215512345678, 8181234567"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 text-base placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                />
                <p className="mt-1.5 text-sm text-slate-600">México: 10 dígitos o 52 + 10 dígitos. Con Twilio configurado se envía realmente.</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={incluirResumenAI}
                  onChange={(e) => setIncluirResumenAI(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-slate-300 text-sky-600 focus:ring-2 focus:ring-sky-400"
                />
                <span className="text-base font-medium text-slate-900">Incluir resumen en lenguaje natural (IA)</span>
              </label>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleGenerarPreview}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#001e50] dark:bg-blue-600 text-white font-bold text-sm uppercase hover:opacity-90 focus:ring-2 focus:ring-blue-400 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                  Generar vista previa
                </button>
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm uppercase hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  Enviar por correo / WhatsApp
                </button>
              </div>
            </div>
          </div>

          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2rem] p-8 border-2 border-sky-200 bg-white shadow-md space-y-6 max-w-3xl"
            >
              <h3 className="text-base font-black text-slate-900 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle size={22} />
                </span>
                Resultado
              </h3>

              {preview.email?.enviado && (
                <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-start gap-3">
                  <CheckCircle size={24} className="shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <p className="font-bold text-base text-slate-900">Correo enviado correctamente</p>
                    <p className="text-sm mt-1 text-slate-700">{preview.email.mensaje}</p>
                  </div>
                </div>
              )}
              {preview.email?.demo && (
                <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-start gap-3">
                  <Info size={24} className="shrink-0 mt-0.5 text-amber-700" />
                  <div className="min-w-0">
                    <p className="font-bold text-base text-slate-900">Modo demo (correo)</p>
                    <p className="text-sm mt-1 leading-relaxed text-slate-700">{preview.email.mensaje}</p>
                    <p className="text-sm mt-3 text-slate-800">
                      Abre el archivo{' '}
                      <code className="bg-slate-800 text-white px-2 py-1 rounded font-mono text-xs font-bold">
                        server/output/demo-email.html
                      </code>
                      {' '}para ver el contenido del correo.
                    </p>
                  </div>
                </div>
              )}

              {preview.whatsapp?.enviado && (
                <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-start gap-3">
                  <MessageCircle size={24} className="shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <p className="font-bold text-base text-slate-900">WhatsApp enviado correctamente</p>
                    <p className="text-sm mt-1 text-slate-700">{preview.whatsapp.mensaje}</p>
                  </div>
                </div>
              )}
              {preview.whatsapp?.demo && preview.whatsapp.mensajeWhatsApp && (
                <div className="p-5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                  <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <MessageCircle size={18} className="text-emerald-600" />
                    {preview.whatsapp.enviado ? 'Mensaje enviado por WhatsApp' : 'Mensaje que se enviaría por WhatsApp (modo demo)'}
                  </p>
                  <div className="p-5 rounded-xl bg-white border-2 border-sky-100 shadow-sm">
                    <p className="text-slate-900 text-base leading-relaxed whitespace-pre-wrap font-medium">{preview.whatsapp.mensajeWhatsApp}</p>
                  </div>
                  {!preview.whatsapp.enviado && preview.whatsapp.mensaje && (
                    <p className="text-sm text-slate-600 mt-3">{preview.whatsapp.mensaje}</p>
                  )}
                </div>
              )}

              {preview.resumenAI && (
                <div>
                  <p className="text-sm font-bold text-slate-900 mb-2">Resumen en lenguaje natural (IA)</p>
                  <div className="p-5 rounded-xl bg-violet-50 border-2 border-violet-200">
                    <p className="text-slate-900 text-base leading-relaxed">{preview.resumenAI}</p>
                  </div>
                </div>
              )}
              {preview.contenidoTexto && (
                <details className="group">
                  <summary className="text-sm font-bold text-slate-700 cursor-pointer list-none flex items-center gap-2 hover:text-slate-900 transition-colors">
                    Ver reporte completo (texto)
                  </summary>
                  <pre className="mt-3 p-4 rounded-xl bg-slate-100 border-2 border-slate-200 text-sm overflow-x-auto whitespace-pre-wrap font-mono text-slate-900 leading-relaxed">{preview.contenidoTexto}</pre>
                </details>
              )}
            </motion.div>
          )}
        </>
      )}

      <div className="rounded-2xl px-6 py-4 border-2 border-blue-200 bg-blue-50 max-w-2xl">
        <p className="text-sm text-slate-800 leading-relaxed">
          <strong className="text-slate-900">Envío real:</strong> En <code className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-xs font-mono">server/.env</code> configura <code className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-xs font-mono">SMTP_*</code> para correo y <code className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-xs font-mono">TWILIO_*</code> para WhatsApp. Ver <code className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-xs font-mono">server/.env.example</code>.
        </p>
      </div>
    </motion.div>
  );
};
