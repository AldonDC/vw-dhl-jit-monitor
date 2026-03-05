/**
 * Pantalla de login inicial — Torre de Control JIT · VW Puebla / DHL.
 * Se muestra al inicio cuando Supabase está configurado y no hay sesión.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Truck, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logoVw from '../assets/logo-vw.png';

const inputClass = "w-full px-4 py-3.5 rounded-xl text-sm font-medium bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#001e50]/50 dark:focus:ring-blue-500/50 focus:border-[#001e50] dark:focus:border-blue-500 transition-all";
const labelClass = "block text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2 text-left";

export const Login: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) setError(err.message || 'Credenciales incorrectas. Revisa correo y contraseña.');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await signUp(email, password);
    setSubmitting(false);
    if (err) {
      const msg = err.message || 'No se pudo crear la cuenta.';
      const hint = msg.toLowerCase().includes('invalid')
        ? ' En Supabase: Authentication → Providers → Email revisa si hay "Allow list" de dominios o desactiva restricciones para pruebas.'
        : '';
      setError(msg + hint);
      return;
    }
    setSuccess('Cuenta creada. Ya puedes iniciar sesión con tu correo y contraseña.');
    setConfirmPassword('');
    setIsSignUp(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500">
      {/* Fondo profesional: gradiente corporativo + patrones sutiles */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        {/* Base: gradiente suave slate → azul corporativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-blue-950/40 dark:to-slate-900" />
        {/* Refuerzo de profundidad */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(0,30,80,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(59,130,246,0.12),transparent_50%)]" />
        {/* Patrón de puntos sutil (estilo control room) */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        {/* Orbes de marca: VW blue y DHL amber, muy suaves */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-[800px] h-[70vh] bg-[#001e50]/[0.07] dark:bg-[#001e50]/15 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[50%] max-w-[500px] h-[50vh] bg-[#ffcc00]/[0.06] dark:bg-amber-500/10 blur-[80px] rounded-full" />
        <div className="absolute bottom-1/4 left-0 w-[40%] max-w-[400px] h-[40vh] bg-[#001e50]/[0.05] dark:bg-blue-600/10 blur-[90px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md px-6"
      >
        <div className="relative rounded-[2rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-600 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl ring-1 ring-slate-200/50 dark:ring-slate-500/20">
          {/* Acento DHL (franja amarilla sutil) */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#001e50] via-[#ffcc00] to-[#001e50] opacity-90" />

          <div className="flex flex-col items-center text-center mb-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-xl border border-black/5 dark:border-white/10 p-3 mb-6"
            >
              <img src={logoVw} alt="Volkswagen" className="w-full h-full object-contain" />
            </motion.div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">
              Logistics Hub
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-600 dark:text-slate-300 mt-2">
              Torre de control JIT · Puebla
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-4 max-w-xs">
              Acceso restringido a supervisores y personal autorizado.
            </p>
          </div>

          {success && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              {success}
            </motion.p>
          )}

          {isSignUp ? (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label htmlFor="signup-email" className={labelClass}>Correo</label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu.correo@empresa.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="signup-password" className={labelClass}>Contraseña (mín. 6 caracteres)</label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="signup-confirm" className={labelClass}>Confirmar contraseña</label>
                <input
                  id="signup-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Shield size={14} aria-hidden />
                  {error}
                </motion.p>
              )}
              <button
                type="submit"
                disabled={submitting || !email.trim() || !password || !confirmPassword}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl text-sm font-black uppercase tracking-widest bg-emerald-600 dark:bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              >
                <UserPlus size={20} aria-hidden />
                {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(''); setSuccess(''); }}
                className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-[#001e50] dark:hover:text-blue-400 transition-colors"
              >
                ¿Ya tienes cuenta? Iniciar sesión
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-email" className={labelClass}>Correo</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu.correo@empresa.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="login-password" className={labelClass}>Contraseña</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Shield size={14} aria-hidden />
                  {error}
                </motion.p>
              )}
              <button
                type="submit"
                disabled={submitting || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl text-sm font-black uppercase tracking-widest bg-[#001e50] dark:bg-blue-600 text-white shadow-lg shadow-[#001e50]/25 dark:shadow-blue-600/25 hover:bg-[#002a6e] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              >
                <LogIn size={20} aria-hidden />
                {submitting ? 'Verificando…' : 'Iniciar sesión'}
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(''); setSuccess(''); }}
                className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-[#001e50] dark:hover:text-blue-400 transition-colors"
              >
                ¿No tienes cuenta? Crear usuario
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <Truck size={12} aria-hidden />
            <span>VW Puebla · DHL Supply Chain</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
